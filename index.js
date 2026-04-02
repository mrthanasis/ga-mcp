import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import express from "express";

const app = express();
app.use(express.json());

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const analyticsClient = new BetaAnalyticsDataClient({ credentials });
const PROPERTY_ID = process.env.GA_PROPERTY_ID;

function createServer() {
  const server = new Server(
    { name: "google-analytics-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: "get_overview", description: "Sessions, users, pageviews, bounce rate για date range", inputSchema: { type: "object", properties: { start_date: { type: "string" }, end_date: { type: "string" } }, required: ["start_date", "end_date"] } },
      { name: "get_top_pages", description: "Top σελίδες βάσει pageviews", inputSchema: { type: "object", properties: { start_date: { type: "string" }, end_date: { type: "string" }, limit: { type: "number" } }, required: ["start_date", "end_date"] } },
      { name: "get_traffic_sources", description: "Πού έρχεται η επισκεψιμότητα", inputSchema: { type: "object", properties: { start_date: { type: "string" }, end_date: { type: "string" } }, required: ["start_date", "end_date"] } },
      { name: "get_devices", description: "Breakdown ανά device", inputSchema: { type: "object", properties: { start_date: { type: "string" }, end_date: { type: "string" } }, required: ["start_date", "end_date"] } },
      { name: "get_countries", description: "Top χώρες επισκεπτών", inputSchema: { type: "object", properties: { start_date: { type: "string" }, end_date: { type: "string" }, limit: { type: "number" } }, required: ["start_date", "end_date"] } },
      { name: "get_realtime", description: "Live χρήστες αυτή τη στιγμή", inputSchema: { type: "object", properties: {} } },
      { name: "compare_periods", description: "Σύγκριση δύο periods", inputSchema: { type: "object", properties: { current_start: { type: "string" }, current_end: { type: "string" }, previous_start: { type: "string" }, previous_end: { type: "string" } }, required: ["current_start", "current_end", "previous_start", "previous_end"] } }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      if (name === "get_overview") {
        const [res] = await analyticsClient.runReport({
          property: `properties/${PROPERTY_ID}`,
          dateRanges: [{ startDate: args.start_date, endDate: args.end_date }],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }, { name: "screenPageViews" }, { name: "bounceRate" }, { name: "averageSessionDuration" }, { name: "engagementRate" }]
        });
        const r = res.rows?.[0]?.metricValues ?? [];
        return { content: [{ type: "text", text: JSON.stringify({ period: `${args.start_date} → ${args.end_date}`, sessions: r[0]?.value, activeUsers: r[1]?.value, newUsers: r[2]?.value, pageviews: r[3]?.value, bounceRate: `${(parseFloat(r[4]?.value||0)*100).toFixed(1)}%`, avgSessionDuration: `${Math.round(parseFloat(r[5]?.value||0))}s`, engagementRate: `${(parseFloat(r[6]?.value||0)*100).toFixed(1)}%` }, null, 2) }] };
      }
      if (name === "get_top_pages") {
        const [res] = await analyticsClient.runReport({
          property: `properties/${PROPERTY_ID}`,
          dateRanges: [{ startDate: args.start_date, endDate: args.end_date }],
          dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
          metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "averageSessionDuration" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: args.limit || 10
        });
        return { content: [{ type: "text", text: JSON.stringify(res.rows?.map(row => ({ path: row.dimensionValues[0].value, title: row.dimensionValues[1].value, pageviews: row.metricValues[0].value, users: row.metricValues[1].value, avgDuration: `${Math.round(parseFloat(row.metricValues[2].value))}s` })), null, 2) }] };
      }
      if (name === "get_traffic_sources") {
        const [res] = await analyticsClient.runReport({
          property: `properties/${PROPERTY_ID}`,
          dateRanges: [{ startDate: args.start_date, endDate: args.end_date }],
          dimensions: [{ name: "sessionDefaultChannelGrouping" }],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "bounceRate" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }]
        });
        return { content: [{ type: "text", text: JSON.stringify(res.rows?.map(row => ({ channel: row.dimensionValues[0].value, sessions: row.metricValues[0].value, users: row.metricValues[1].value, bounceRate: `${(parseFloat(row.metricValues[2].value)*100).toFixed(1)}%` })), null, 2) }] };
      }
      if (name === "get_devices") {
        const [res] = await analyticsClient.runReport({
          property: `properties/${PROPERTY_ID}`,
          dateRanges: [{ startDate: args.start_date, endDate: args.end_date }],
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }]
        });
        return { content: [{ type: "text", text: JSON.stringify(res.rows?.map(row => ({ device: row.dimensionValues[0].value, sessions: row.metricValues[0].value, users: row.metricValues[1].value })), null, 2) }] };
      }
      if (name === "get_countries") {
        const [res] = await analyticsClient.runReport({
          property: `properties/${PROPERTY_ID}`,
          dateRanges: [{ startDate: args.start_date, endDate: args.end_date }],
          dimensions: [{ name: "country" }],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: args.limit || 10
        });
        return { content: [{ type: "text", text: JSON.stringify(res.rows?.map(row => ({ country: row.dimensionValues[0].value, sessions: row.metricValues[0].value, users: row.metricValues[1].value })), null, 2) }] };
      }
      if (name === "get_realtime") {
        const [res] = await analyticsClient.runRealtimeReport({
          property: `properties/${PROPERTY_ID}`,
          metrics: [{ name: "activeUsers" }],
          dimensions: [{ name: "country" }, { name: "deviceCategory" }]
        });
        const total = res.rows?.reduce((sum, row) => sum + parseInt(row.metricValues[0].value), 0) || 0;
        return { content: [{ type: "text", text: JSON.stringify({ totalActiveUsers: total, breakdown: res.rows?.map(row => ({ country: row.dimensionValues[0].value, device: row.dimensionValues[1].value, users: row.metricValues[0].value })) }, null, 2) }] };
      }
      if (name === "compare_periods") {
        const [res] = await analyticsClient.runReport({
          property: `properties/${PROPERTY_ID}`,
          dateRanges: [
            { startDate: args.current_start, endDate: args.current_end, name: "current" },
            { startDate: args.previous_start, endDate: args.previous_end, name: "previous" }
          ],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }, { name: "bounceRate" }]
        });
        const get = (rows, i) => { const mv = rows?.[0]?.metricValues ?? []; return { sessions: mv[i*4]?.value, users: mv[i*4+1]?.value, pageviews: mv[i*4+2]?.value, bounceRate: `${(parseFloat(mv[i*4+3]?.value||0)*100).toFixed(1)}%` }; };
        return { content: [{ type: "text", text: JSON.stringify({ current: { period: `${args.current_start} → ${args.current_end}`, ...get(res.rows, 0) }, previous: { period: `${args.previous_start} → ${args.previous_end}`, ...get(res.rows, 1) } }, null, 2) }] };
      }
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  });

  return server;
}

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GA MCP running on port ${PORT}`));