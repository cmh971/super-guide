// Highrock Health Monitor
//
// A tiny standalone microservice (no external dependencies — std lib only) that
// continuously probes the dashboard's /healthz endpoint and exposes:
//
//	GET /            -> a live HTML status page (auto-refreshing)
//	GET /status      -> aggregated JSON status of every monitored target
//	GET /healthz     -> 200 if the monitor itself is up
//
// Configure targets with the TARGETS env var (comma-separated name=url pairs),
// e.g.  TARGETS="dashboard=http://localhost:3000/healthz"
//
// Run:  go run .      (from dashboard/helpers/go-health)
// Build: go build -o healthmon
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Target is one URL we keep an eye on.
type Target struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// Result is the most recent probe outcome for a target.
type Result struct {
	Name       string    `json:"name"`
	URL        string    `json:"url"`
	Up         bool      `json:"up"`
	StatusCode int       `json:"statusCode"`
	LatencyMS  int64     `json:"latencyMs"`
	Error      string    `json:"error,omitempty"`
	CheckedAt  time.Time `json:"checkedAt"`
}

// Monitor holds the shared, concurrency-safe state.
type Monitor struct {
	mu      sync.RWMutex
	results map[string]Result
	targets []Target
	client  *http.Client
	started time.Time
}

func NewMonitor(targets []Target) *Monitor {
	return &Monitor{
		results: make(map[string]Result),
		targets: targets,
		client:  &http.Client{Timeout: 5 * time.Second},
		started: time.Now(),
	}
}

// probe hits a single target once and records the result.
func (m *Monitor) probe(t Target) {
	start := time.Now()
	res := Result{Name: t.Name, URL: t.URL, CheckedAt: time.Now()}

	resp, err := m.client.Get(t.URL)
	res.LatencyMS = time.Since(start).Milliseconds()
	if err != nil {
		res.Up = false
		res.Error = err.Error()
	} else {
		defer resp.Body.Close()
		res.StatusCode = resp.StatusCode
		res.Up = resp.StatusCode >= 200 && resp.StatusCode < 400
	}

	m.mu.Lock()
	m.results[t.Name] = res
	m.mu.Unlock()
}

// runLoop probes every target on a fixed interval, forever.
func (m *Monitor) runLoop(interval time.Duration) {
	for {
		var wg sync.WaitGroup
		for _, t := range m.targets {
			wg.Add(1)
			go func(tt Target) {
				defer wg.Done()
				m.probe(tt)
			}(t)
		}
		wg.Wait()
		time.Sleep(interval)
	}
}

func (m *Monitor) snapshot() []Result {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Result, 0, len(m.targets))
	for _, t := range m.targets {
		if r, ok := m.results[t.Name]; ok {
			out = append(out, r)
		} else {
			out = append(out, Result{Name: t.Name, URL: t.URL, Up: false, Error: "not yet probed"})
		}
	}
	return out
}

func (m *Monitor) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	payload := map[string]any{
		"monitor":   "highrock-health",
		"uptimeSec": int(time.Since(m.started).Seconds()),
		"targets":   m.snapshot(),
		"checkedAt": time.Now(),
	}
	_ = json.NewEncoder(w).Encode(payload)
}

func (m *Monitor) handlePage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	var b strings.Builder
	b.WriteString(`<!doctype html><html><head><meta charset="utf-8">`)
	b.WriteString(`<meta http-equiv="refresh" content="5"><title>Highrock Health</title>`)
	b.WriteString(`<style>body{background:#0b0d17;color:#e8ebff;font-family:Inter,system-ui,sans-serif;padding:40px}`)
	b.WriteString(`h1{font-weight:800}.row{display:flex;gap:14px;align-items:center;padding:14px 18px;margin:10px 0;`)
	b.WriteString(`border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}`)
	b.WriteString(`.dot{width:12px;height:12px;border-radius:50%}.up{background:#22c55e;box-shadow:0 0 12px #22c55e}`)
	b.WriteString(`.down{background:#ef4444;box-shadow:0 0 12px #ef4444}.muted{color:#9aa3c7;font-size:13px}</style></head><body>`)
	b.WriteString(`<h1>🩺 Highrock Health Monitor</h1>`)
	b.WriteString(fmt.Sprintf(`<p class="muted">Uptime: %ds · auto-refreshing every 5s</p>`, int(time.Since(m.started).Seconds())))
	for _, r := range m.snapshot() {
		cls := "down"
		label := "DOWN"
		if r.Up {
			cls = "up"
			label = "UP"
		}
		extra := r.Error
		if extra == "" {
			extra = fmt.Sprintf("HTTP %d", r.StatusCode)
		}
		b.WriteString(fmt.Sprintf(
			`<div class="row"><div class="dot %s"></div><div><b>%s</b> — %s<br><span class="muted">%s · %dms · %s</span></div></div>`,
			cls, htmlEscape(r.Name), label, htmlEscape(r.URL), r.LatencyMS, htmlEscape(extra),
		))
	}
	b.WriteString(`</body></html>`)
	_, _ = w.Write([]byte(b.String()))
}

func htmlEscape(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;")
	return r.Replace(s)
}

// parseTargets reads the TARGETS env var, falling back to a sensible default.
func parseTargets() []Target {
	raw := os.Getenv("TARGETS")
	if raw == "" {
		raw = "dashboard=http://localhost:3000/healthz"
	}
	var targets []Target
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		targets = append(targets, Target{Name: strings.TrimSpace(kv[0]), URL: strings.TrimSpace(kv[1])})
	}
	return targets
}

func main() {
	port := os.Getenv("HEALTH_PORT")
	if port == "" {
		port = "8090"
	}

	targets := parseTargets()
	mon := NewMonitor(targets)
	go mon.runLoop(5 * time.Second)

	mux := http.NewServeMux()
	mux.HandleFunc("/", mon.handlePage)
	mux.HandleFunc("/status", mon.handleStatus)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true,"service":"health-monitor"}`))
	})

	log.Printf("🩺 Health monitor on :%s — watching %d target(s)", port, len(targets))
	for _, t := range targets {
		log.Printf("   • %s -> %s", t.Name, t.URL)
	}
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
