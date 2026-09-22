/**
 * Tier 4 — WebArena-style (20 fixtures)
 *
 * Simulated DOM snapshots / HTML content that Fox must compress
 * without losing semantic structure.
 */
import type { ChallengeFixture } from "../types"

function makeWebArena(idx: number): { content: string; must: string[] } {
  const templates = [
    () => ({
      content: `<html><head><title>Dashboard — Admin Panel</title></head><body>
<nav id="main-nav"><ul>
  <li><a href="/dashboard" class="active">Dashboard</a></li>
  <li><a href="/users">Users (${1234 + idx * 10})</a></li>
  <li><a href="/orders">Orders (${567 + idx * 5})</a></li>
  <li><a href="/settings">Settings</a></li>
</ul></nav>
<main id="content">
  <h1>Admin Dashboard</h1>
  <div class="stats-grid">
    <div class="stat-card"><h3>Active Users</h3><span class="value">${4567 + idx * 100}</span></div>
    <div class="stat-card"><h3>Revenue Today</h3><span class="value">$${(12345 + idx * 500).toLocaleString()}</span></div>
    <div class="stat-card"><h3>Open Tickets</h3><span class="value">${23 + idx}</span></div>
    <div class="stat-card"><h3>Server Load</h3><span class="value">${(67 + idx * 2)}%</span></div>
  </div>
  <table id="recent-orders">
    <thead><tr><th>Order ID</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>
${Array.from({ length: 5 }, (_, j) => `      <tr><td>#${10000 + idx * 10 + j}</td><td>Customer ${j + 1}</td><td>$${(99.99 + j * 25).toFixed(2)}</td><td>${["pending", "shipped", "delivered", "pending", "cancelled"][j]}</td></tr>`).join("\n")}
    </tbody>
  </table>
</main></body></html>`,
      must: ["Admin Dashboard", "Active Users", "recent-orders", "pending"],
    }),
    () => ({
      content: `<form id="checkout-form" action="/api/checkout" method="POST">
  <fieldset>
    <legend>Shipping Information</legend>
    <div class="form-group">
      <label for="name">Full Name</label>
      <input type="text" id="name" name="name" value="John Doe" required />
    </div>
    <div class="form-group">
      <label for="address">Address</label>
      <textarea id="address" name="address" rows="3">123 Main St, Apt ${idx + 1}\nNew York, NY 10001</textarea>
    </div>
    <div class="form-group">
      <label for="shipping">Shipping Method</label>
      <select id="shipping" name="shipping_method">
        <option value="standard" ${idx % 2 === 0 ? "selected" : ""}>Standard (5-7 days) — Free</option>
        <option value="express" ${idx % 2 === 1 ? "selected" : ""}>Express (2-3 days) — $9.99</option>
        <option value="overnight">Overnight — $24.99</option>
      </select>
    </div>
  </fieldset>
  <fieldset>
    <legend>Payment</legend>
    <div class="form-group">
      <label for="card">Card Number</label>
      <input type="text" id="card" name="card" placeholder="**** **** **** ****" />
    </div>
    <div class="form-group">
      <label for="cvv">CVV</label>
      <input type="text" id="cvv" name="cvv" maxlength="3" />
    </div>
  </fieldset>
  <div class="order-summary">
    <p>Subtotal: $${(149.97 + idx * 10).toFixed(2)}</p>
    <p>Shipping: $${idx % 2 === 0 ? "0.00" : "9.99"}</p>
    <p class="total">Total: $${(149.97 + idx * 10 + (idx % 2 === 0 ? 0 : 9.99)).toFixed(2)}</p>
  </div>
  <button type="submit" id="place-order">Place Order</button>
</form>`,
      must: ["checkout-form", "Shipping Information", "Payment", "Place Order"],
    }),
    () => ({
      content: `<div id="search-results">
  <div class="search-header">
    <h2>Search results for: "typescript async patterns"</h2>
    <p class="result-count">About ${12300 + idx * 100} results (${(0.42 + idx * 0.01).toFixed(2)} seconds)</p>
  </div>
${Array.from({ length: 5 }, (_, j) => `  <div class="result-item" data-rank="${j + 1}">
    <a href="https://example.com/article-${idx * 5 + j}" class="result-title">
      ${["Understanding TypeScript Async/Await", "Advanced Promise Patterns", "Error Handling in Async TypeScript", "TypeScript Concurrency Guide", "Building Async APIs with TypeScript"][j]}
    </a>
    <cite class="result-url">https://example.com/article-${idx * 5 + j}</cite>
    <p class="result-snippet">Learn how to ${["implement async/await patterns", "chain promises effectively", "handle errors in async code", "manage concurrent operations", "design async API endpoints"][j]} in TypeScript with practical examples and best practices...</p>
  </div>`).join("\n")}
  <nav class="pagination">
    <a href="?page=${idx}" class="prev">Previous</a>
    <span class="current">Page ${idx + 1}</span>
    <a href="?page=${idx + 2}" class="next">Next</a>
  </nav>
</div>`,
      must: ["search-results", "typescript async patterns", "result-count", "pagination"],
    }),
    () => ({
      content: `<div id="file-manager">
  <div class="toolbar">
    <button id="btn-upload">Upload</button>
    <button id="btn-new-folder">New Folder</button>
    <button id="btn-delete" disabled>Delete</button>
    <input type="search" id="file-search" placeholder="Search files..." />
  </div>
  <div class="breadcrumb">
    <a href="/">Home</a> / <a href="/documents">Documents</a> / <span>Project Files</span>
  </div>
  <table class="file-list">
    <thead><tr><th>Name</th><th>Size</th><th>Modified</th><th>Type</th></tr></thead>
    <tbody>
${Array.from({ length: 8 }, (_, j) => {
  const names = ["README.md", "package.json", "tsconfig.json", "src/", "test/", "docs/", ".gitignore", "Dockerfile"]
  const sizes = ["4.2 KB", "2.1 KB", "856 B", "--", "--", "--", "234 B", "1.1 KB"]
  const types = ["Markdown", "JSON", "JSON", "Folder", "Folder", "Folder", "Text", "Docker"]
  return `      <tr data-path="${names[j]}"><td>${names[j]}</td><td>${sizes[j]}</td><td>Sep ${20 - j}, 2026</td><td>${types[j]}</td></tr>`
}).join("\n")}
    </tbody>
  </table>
</div>`,
      must: ["file-manager", "btn-upload", "breadcrumb", "README.md", "Dockerfile"],
    }),
  ]
  return templates[idx % templates.length]!()
}

export const TIER4_WEBARENA_FIXTURES: readonly ChallengeFixture[] = Array.from(
  { length: 20 },
  (_, idx) => {
    const { content, must } = makeWebArena(idx)
    return {
      id: `webarena-t4-${String(idx + 1).padStart(2, "0")}`,
      tier: 4 as const,
      category: "webarena-style" as const,
      description: `WebArena-style: DOM snapshot variant ${idx + 1}`,
      seed: 31000 + idx,
      input: { content, tool: "read" as const },
      expected: {
        type: "objective" as const,
        mustContain: must,
        workflow: "swe" as const,
      },
    }
  },
)
