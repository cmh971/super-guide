// Highrock Staff Dashboard — Log Analyzer (C#)
//
// Connects to the same MongoDB the dashboard & bot use, then turns the raw
// audit log and command-job history into a readable report:
//   • totals & per-action breakdown
//   • most active staff
//   • command success / error rate
//   • busiest hour of day
// It also writes an HTML report to ./report.html.
//
// Usage:
//   dotnet run                       (reads MONGO_URI from ../../../.env or env)
//   dotnet run -- "<mongo-uri>"      (override connection string)
//
// Build a single exe:  dotnet publish -c Release

using DotNetEnv;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Text;

namespace Highrock.LogAnalyzer;

internal static class Program
{
    private const string DatabaseName = "Highrock";

    private static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        PrintBanner();

        var mongoUri = ResolveMongoUri(args);
        if (string.IsNullOrWhiteSpace(mongoUri))
        {
            Console.WriteLine("❌ No MONGO_URI found. Pass it as an argument or set it in .env.");
            return 1;
        }

        IMongoDatabase db;
        try
        {
            var client = new MongoClient(mongoUri);
            db = client.GetDatabase(DatabaseName);
            // Force a round-trip so we fail fast on bad credentials/host.
            await db.RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1));
            Console.WriteLine($"✅ Connected to MongoDB database '{DatabaseName}'.\n");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Could not connect to MongoDB: {ex.Message}");
            return 1;
        }

        var audits = await db.GetCollection<BsonDocument>("auditlogs")
            .Find(FilterDefinition<BsonDocument>.Empty).ToListAsync();
        var jobs = await db.GetCollection<BsonDocument>("commandjobs")
            .Find(FilterDefinition<BsonDocument>.Empty).ToListAsync();

        var report = BuildReport(audits, jobs);
        PrintReport(report);
        WriteHtml(report);

        Console.WriteLine("\n📄 HTML report written to report.html");
        return 0;
    }

    private static string ResolveMongoUri(string[] args)
    {
        // Accept a connection string as the first arg, but ignore option-style
        // tokens like "--nologo" that a launcher might forward by accident.
        if (args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]) && !args[0].StartsWith("--"))
            return args[0];

        // If a launcher already exported it, use that.
        var fromEnv = Environment.GetEnvironmentVariable("MONGO_URI");
        if (!string.IsNullOrWhiteSpace(fromEnv)) return fromEnv;

        // Otherwise search upward from both the build dir and the working dir
        // for a .env file (robust regardless of how deep bin/Release/... is).
        foreach (var start in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            var dir = new DirectoryInfo(start);
            while (dir != null)
            {
                var candidate = Path.Combine(dir.FullName, ".env");
                if (File.Exists(candidate))
                {
                    Env.Load(candidate);
                    return Environment.GetEnvironmentVariable("MONGO_URI") ?? string.Empty;
                }
                dir = dir.Parent;
            }
        }
        return string.Empty;
    }

    private static Report BuildReport(List<BsonDocument> audits, List<BsonDocument> jobs)
    {
        var report = new Report { TotalEvents = audits.Count, TotalJobs = jobs.Count };

        foreach (var a in audits)
        {
            var action = a.GetValue("action", "unknown").AsString;
            report.ActionCounts.TryGetValue(action, out var ac);
            report.ActionCounts[action] = ac + 1;

            var user = a.Contains("username") && !a["username"].IsBsonNull
                ? a["username"].AsString : "unknown";
            report.UserCounts.TryGetValue(user, out var uc);
            report.UserCounts[user] = uc + 1;

            if (a.Contains("createdAt") && a["createdAt"].IsValidDateTime)
            {
                var hour = a["createdAt"].ToUniversalTime().Hour;
                report.HourBuckets[hour]++;
            }
        }

        foreach (var j in jobs)
        {
            var status = j.GetValue("status", "unknown").AsString;
            if (status == "done") report.JobsDone++;
            else if (status == "error") report.JobsError++;

            var cmd = j.GetValue("command", "unknown").AsString;
            report.CommandCounts.TryGetValue(cmd, out var cc);
            report.CommandCounts[cmd] = cc + 1;
        }

        return report;
    }

    private static void PrintReport(Report r)
    {
        Section("📊 Totals");
        Console.WriteLine($"  Audit events : {r.TotalEvents}");
        Console.WriteLine($"  Command jobs : {r.TotalJobs}");
        Console.WriteLine($"  Success rate : {r.SuccessRate:P0}  ({r.JobsDone} ok / {r.JobsError} errors)");

        Section("🏷️  Events by action");
        foreach (var kv in r.ActionCounts.OrderByDescending(k => k.Value))
            Console.WriteLine($"  {Bar(kv.Value, r.TotalEvents)} {kv.Key,-16} {kv.Value}");

        Section("👥 Most active staff");
        foreach (var kv in r.UserCounts.OrderByDescending(k => k.Value).Take(10))
            Console.WriteLine($"  {kv.Value,4}  {kv.Key}");

        Section("⚡ Commands run");
        foreach (var kv in r.CommandCounts.OrderByDescending(k => k.Value))
            Console.WriteLine($"  {kv.Value,4}  {kv.Key}");

        Section("🕐 Busiest hours (UTC)");
        var peak = r.HourBuckets.Max();
        for (var h = 0; h < 24; h++)
        {
            if (r.HourBuckets[h] == 0) continue;
            Console.WriteLine($"  {h:00}:00  {BarOf(r.HourBuckets[h], peak)} {r.HourBuckets[h]}");
        }
    }

    private static void WriteHtml(Report r)
    {
        var sb = new StringBuilder();
        sb.Append("<!doctype html><html><head><meta charset='utf-8'><title>Highrock Log Report</title>");
        sb.Append("<style>body{background:#0b0d17;color:#e8ebff;font-family:Inter,system-ui,sans-serif;padding:40px}");
        sb.Append("h1{font-weight:800}h2{margin-top:28px;color:#9aa3c7}table{border-collapse:collapse;margin-top:8px}");
        sb.Append("td,th{padding:6px 18px 6px 0;text-align:left}.bar{background:#5865f2;height:10px;border-radius:5px;display:inline-block}</style>");
        sb.Append("</head><body><h1>📊 Highrock Staff — Log Report</h1>");
        sb.Append($"<p>Generated {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC · {r.TotalEvents} events · {r.TotalJobs} jobs · success {r.SuccessRate:P0}</p>");

        sb.Append("<h2>Events by action</h2><table>");
        foreach (var kv in r.ActionCounts.OrderByDescending(k => k.Value))
            sb.Append($"<tr><td>{kv.Key}</td><td>{kv.Value}</td><td><span class='bar' style='width:{Math.Max(4, kv.Value * 200 / Math.Max(1, r.TotalEvents))}px'></span></td></tr>");
        sb.Append("</table>");

        sb.Append("<h2>Most active staff</h2><table>");
        foreach (var kv in r.UserCounts.OrderByDescending(k => k.Value).Take(10))
            sb.Append($"<tr><td>{System.Net.WebUtility.HtmlEncode(kv.Key)}</td><td>{kv.Value}</td></tr>");
        sb.Append("</table></body></html>");

        File.WriteAllText("report.html", sb.ToString());
    }

    private static void Section(string title)
    {
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine(title);
        Console.ResetColor();
    }

    private static string Bar(int value, int total)
    {
        var width = total == 0 ? 0 : (int)Math.Round(value * 20.0 / total);
        return "[" + new string('#', width).PadRight(20) + "]";
    }

    private static string BarOf(int value, int peak)
    {
        var width = peak == 0 ? 0 : (int)Math.Round(value * 20.0 / peak);
        return new string('▇', Math.Max(1, width));
    }

    private static void PrintBanner()
    {
        Console.ForegroundColor = ConsoleColor.Magenta;
        Console.WriteLine("==============================================");
        Console.WriteLine("   Kansas State Roleplay — Log Analyzer");
        Console.WriteLine("==============================================");
        Console.ResetColor();
    }
}

internal sealed class Report
{
    public int TotalEvents { get; set; }
    public int TotalJobs { get; set; }
    public int JobsDone { get; set; }
    public int JobsError { get; set; }
    public Dictionary<string, int> ActionCounts { get; } = new();
    public Dictionary<string, int> UserCounts { get; } = new();
    public Dictionary<string, int> CommandCounts { get; } = new();
    public int[] HourBuckets { get; } = new int[24];

    public double SuccessRate =>
        (JobsDone + JobsError) == 0 ? 1.0 : (double)JobsDone / (JobsDone + JobsError);
}
