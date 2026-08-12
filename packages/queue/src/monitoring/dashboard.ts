/**
 * @module monitoring/dashboard
 * @description Lightweight HTML dashboard for queue monitoring.
 * Generates a self-contained HTML page with queue status overview.
 */

import type { QueueConfig } from "../config/schema.js";
import { runHealthCheck } from "./health.js";
import { captureMetrics } from "./metrics.js";

// ---------------------------------------------------------------------------
// HTML Dashboard
// ---------------------------------------------------------------------------

/**
 * Generate a self-contained HTML dashboard page.
 */
export async function generateDashboardHtml(config: QueueConfig): Promise<string> {
  const [healthReports, metrics] = await Promise.all([runHealthCheck(config), captureMetrics(config)]);

  const statusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "#22c55e";
      case "degraded":
        return "#f59e0b";
      default:
        return "#ef4444";
    }
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Abugida Queue Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .timestamp { color: #64748b; margin-bottom: 2rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: #1e293b; padding: 1rem; border-radius: 8px; }
    .stat-card h3 { font-size: 0.875rem; color: #64748b; margin-bottom: 0.5rem; }
    .stat-card .value { font-size: 1.5rem; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
    th { text-align: left; padding: 0.75rem 1rem; background: #334155; font-size: 0.875rem; color: #94a3b8; }
    td { padding: 0.75rem 1rem; border-top: 1px solid #334155; font-size: 0.875rem; }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
  </style>
</head>
<body>
  <h1>Abugida Queue Dashboard</h1>
  <p class="timestamp">Last updated: ${new Date().toISOString()}</p>

  <div class="stats">
    <div class="stat-card">
      <h3>Total Enqueued</h3>
      <div class="value">${metrics.totalEnqueued}</div>
    </div>
    <div class="stat-card">
      <h3>Total Completed</h3>
      <div class="value" style="color: #22c55e">${metrics.totalCompleted}</div>
    </div>
    <div class="stat-card">
      <h3>Total Failed</h3>
      <div class="value" style="color: ${metrics.totalFailed > 0 ? "#ef4444" : "#22c55e"}">${metrics.totalFailed}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Queue</th>
        <th>Status</th>
        <th>Waiting</th>
        <th>Active</th>
        <th>Completed</th>
        <th>Failed</th>
        <th>Delayed</th>
      </tr>
    </thead>
    <tbody>
      ${healthReports
        .map(
          (r) => `<tr>
        <td><span class="status-dot" style="background: ${statusColor(r.status)}"></span>${r.queueName.replace("abugida.", "")}</td>
        <td style="color: ${statusColor(r.status)}; text-transform: uppercase">${r.status}</td>
        <td>${r.waiting}</td>
        <td>${r.active}</td>
        <td>${r.completed}</td>
        <td style="color: ${r.failed > 0 ? "#ef4444" : "#22c55e"}">${r.failed}</td>
        <td>${r.delayed}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;

  return html;
}
