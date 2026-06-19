// Highrock Staff Dashboard — Crypto Utility (C++)
//
// A small, dependency-free command-line tool for the secrets work around the
// dashboard. Self-contained SHA-256 (FIPS 180-4) + a CSPRNG-backed generator.
//
//   crypto secret [bytes]     generate a random hex secret (default 48 bytes)
//                             -> paste into DASHBOARD_SESSION_SECRET in .env
//   crypto token [bytes]      generate a URL-safe base64 token (default 32 bytes)
//   crypto sha256 <text...>   SHA-256 hex digest of the given text
//   crypto sha256file <path>  SHA-256 hex digest of a file
//   crypto verify <hex> <txt> check that sha256(text) == hex
//
// Build:  g++ -std=c++17 -O2 -o crypto crypto.cpp
//   or:   cmake -S . -B build && cmake --build build

#include <array>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <random>
#include <sstream>
#include <string>
#include <vector>

namespace {

// ---- SHA-256 -------------------------------------------------------------

class Sha256 {
public:
    Sha256() { reset(); }

    void reset() {
        h_ = {0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
              0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u};
        length_ = 0;
        bufLen_ = 0;
    }

    void update(const uint8_t* data, size_t len) {
        length_ += len;
        while (len > 0) {
            size_t take = std::min<size_t>(64 - bufLen_, len);
            std::memcpy(buffer_ + bufLen_, data, take);
            bufLen_ += take;
            data += take;
            len -= take;
            if (bufLen_ == 64) {
                process(buffer_);
                bufLen_ = 0;
            }
        }
    }

    void update(const std::string& s) {
        update(reinterpret_cast<const uint8_t*>(s.data()), s.size());
    }

    std::string hexDigest() {
        // Append the padding and length, per the spec.
        uint64_t bitLen = length_ * 8;
        uint8_t pad = 0x80;
        update(&pad, 1);
        uint8_t zero = 0x00;
        while (bufLen_ != 56) update(&zero, 1);
        uint8_t lenBytes[8];
        for (int i = 7; i >= 0; --i) {
            lenBytes[i] = static_cast<uint8_t>(bitLen & 0xff);
            bitLen >>= 8;
        }
        update(lenBytes, 8);

        std::ostringstream os;
        for (uint32_t v : h_) {
            os << std::hex << std::setw(8) << std::setfill('0') << v;
        }
        return os.str();
    }

private:
    static uint32_t rotr(uint32_t x, uint32_t n) { return (x >> n) | (x << (32 - n)); }

    void process(const uint8_t* block) {
        static const uint32_t k[64] = {
            0x428a2f98u,0x71374491u,0xb5c0fbcfu,0xe9b5dba5u,0x3956c25bu,0x59f111f1u,0x923f82a4u,0xab1c5ed5u,
            0xd807aa98u,0x12835b01u,0x243185beu,0x550c7dc3u,0x72be5d74u,0x80deb1feu,0x9bdc06a7u,0xc19bf174u,
            0xe49b69c1u,0xefbe4786u,0x0fc19dc6u,0x240ca1ccu,0x2de92c6fu,0x4a7484aau,0x5cb0a9dcu,0x76f988dau,
            0x983e5152u,0xa831c66du,0xb00327c8u,0xbf597fc7u,0xc6e00bf3u,0xd5a79147u,0x06ca6351u,0x14292967u,
            0x27b70a85u,0x2e1b2138u,0x4d2c6dfcu,0x53380d13u,0x650a7354u,0x766a0abbu,0x81c2c92eu,0x92722c85u,
            0xa2bfe8a1u,0xa81a664bu,0xc24b8b70u,0xc76c51a3u,0xd192e819u,0xd6990624u,0xf40e3585u,0x106aa070u,
            0x19a4c116u,0x1e376c08u,0x2748774cu,0x34b0bcb5u,0x391c0cb3u,0x4ed8aa4au,0x5b9cca4fu,0x682e6ff3u,
            0x748f82eeu,0x78a5636fu,0x84c87814u,0x8cc70208u,0x90befffau,0xa4506cebu,0xbef9a3f7u,0xc67178f2u};

        uint32_t w[64];
        for (int i = 0; i < 16; ++i) {
            w[i] = (uint32_t(block[i * 4]) << 24) | (uint32_t(block[i * 4 + 1]) << 16) |
                   (uint32_t(block[i * 4 + 2]) << 8) | uint32_t(block[i * 4 + 3]);
        }
        for (int i = 16; i < 64; ++i) {
            uint32_t s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >> 3);
            uint32_t s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16] + s0 + w[i - 7] + s1;
        }

        uint32_t a = h_[0], b = h_[1], c = h_[2], d = h_[3];
        uint32_t e = h_[4], f = h_[5], g = h_[6], hh = h_[7];

        for (int i = 0; i < 64; ++i) {
            uint32_t S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            uint32_t ch = (e & f) ^ (~e & g);
            uint32_t t1 = hh + S1 + ch + k[i] + w[i];
            uint32_t S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
            uint32_t t2 = S0 + maj;
            hh = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
        }

        h_[0] += a; h_[1] += b; h_[2] += c; h_[3] += d;
        h_[4] += e; h_[5] += f; h_[6] += g; h_[7] += hh;
    }

    std::array<uint32_t, 8> h_{};
    uint8_t buffer_[64]{};
    size_t bufLen_ = 0;
    uint64_t length_ = 0;
};

std::string sha256Hex(const std::string& input) {
    Sha256 ctx;
    ctx.update(input);
    return ctx.hexDigest();
}

// ---- Random bytes --------------------------------------------------------

std::vector<uint8_t> randomBytes(size_t n) {
    std::random_device rd;
    std::uniform_int_distribution<int> dist(0, 255);
    std::vector<uint8_t> out(n);
    for (size_t i = 0; i < n; ++i) out[i] = static_cast<uint8_t>(dist(rd));
    return out;
}

std::string toHex(const std::vector<uint8_t>& bytes) {
    std::ostringstream os;
    for (uint8_t b : bytes) os << std::hex << std::setw(2) << std::setfill('0') << int(b);
    return os.str();
}

std::string toBase64Url(const std::vector<uint8_t>& in) {
    static const char* tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    std::string out;
    int val = 0, bits = -6;
    for (uint8_t c : in) {
        val = (val << 8) + c;
        bits += 8;
        while (bits >= 0) {
            out.push_back(tbl[(val >> bits) & 0x3f]);
            bits -= 6;
        }
    }
    if (bits > -6) out.push_back(tbl[((val << 8) >> (bits + 8)) & 0x3f]);
    return out;
}

int usage() {
    std::cout <<
        "Highrock crypto utility\n"
        "  crypto secret [bytes]      random hex secret (default 48)\n"
        "  crypto token [bytes]       URL-safe base64 token (default 32)\n"
        "  crypto sha256 <text...>    SHA-256 of text\n"
        "  crypto sha256file <path>   SHA-256 of a file\n"
        "  crypto verify <hex> <txt>  check sha256(txt) == hex\n";
    return 1;
}

} // namespace

int main(int argc, char** argv) {
    if (argc < 2) return usage();
    std::string cmd = argv[1];

    if (cmd == "secret") {
        size_t n = argc > 2 ? std::stoul(argv[2]) : 48;
        std::cout << toHex(randomBytes(n)) << "\n";
        return 0;
    }
    if (cmd == "token") {
        size_t n = argc > 2 ? std::stoul(argv[2]) : 32;
        std::cout << toBase64Url(randomBytes(n)) << "\n";
        return 0;
    }
    if (cmd == "sha256") {
        if (argc < 3) return usage();
        std::string joined;
        for (int i = 2; i < argc; ++i) {
            if (i > 2) joined += " ";
            joined += argv[i];
        }
        std::cout << sha256Hex(joined) << "\n";
        return 0;
    }
    if (cmd == "sha256file") {
        if (argc < 3) return usage();
        std::ifstream f(argv[2], std::ios::binary);
        if (!f) { std::cerr << "cannot open file\n"; return 1; }
        std::stringstream ss;
        ss << f.rdbuf();
        std::cout << sha256Hex(ss.str()) << "\n";
        return 0;
    }
    if (cmd == "verify") {
        if (argc < 4) return usage();
        std::string expected = argv[2];
        std::string actual = sha256Hex(argv[3]);
        bool ok = (expected == actual);
        std::cout << (ok ? "MATCH" : "MISMATCH") << "\n";
        return ok ? 0 : 2;
    }

    return usage();
}
