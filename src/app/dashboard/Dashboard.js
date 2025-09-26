import React, { Component } from "react";
import { Card, Row, Col, ButtonGroup, Button } from "react-bootstrap";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Line, Bar } from "react-chartjs-2";
import "chart.js";

class Dashboard extends Component {
  state = {
    activities: [],
    lineData: null,
    barData: null,
    filter: "1M", // default filter
    barGroup: "Daily",
  };

  componentDidMount() {
    onSnapshot(collection(db, "activities"), (snapshot) => {
      const activities = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      this.setState({ activities }, () => {
        this.buildLineChart();
        this.buildBarChart();
      });
    });
  }


  filterByRange = (activities, range) => {
  const now = new Date();
  let cutoff;

  switch (range) {
    case "1D":
      cutoff = new Date();
      cutoff.setDate(now.getDate() - 1);
      break;
    case "5D":
      cutoff = new Date();
      cutoff.setDate(now.getDate() - 5);
      break;
    case "1M":
      cutoff = new Date();
      cutoff.setMonth(now.getMonth() - 1);
      break;
    case "1Y":
      cutoff = new Date();
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
    default:
      cutoff = new Date("2000-01-01");
  }

  return activities.filter((a) => new Date(a.date) >= cutoff);
};


// single-hue, different brightness per source
getShade = (i, total, alpha = 0.9) => {
  const hue = 225;           // blue/purple family
  const sat = 80;
  const l0 = 35, l1 = 80;    // lightness range
  const light = l0 + ((l1 - l0) * (i / Math.max(total - 1, 1)));
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
};

// period key + sortable numeric key
periodKey = (dateStr, group) => {
  const d = new Date(`${dateStr}T00:00:00`); // avoid TZ shifts
  if (group === "Daily") {
    const label = d.toISOString().slice(0, 10); // YYYY-MM-DD
    return { label, sort: +new Date(label) };
  }
  if (group === "Weekly") { // ISO week
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
    return { label: `W${String(week).padStart(2, "0")} ${tmp.getUTCFullYear()}`,
             sort: tmp.getUTCFullYear() * 100 + week };
  }
  // Monthly
  const label = `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
  return { label, sort: d.getFullYear() * 100 + (d.getMonth() + 1) };
};


  buildLineChart = () => {
  const { activities, filter } = this.state;
  const filtered = this.filterByRange(activities, filter);

  // Group by date + source
  const grouped = {};
  filtered.forEach((a) => {
    const date = a.date;
    if (!grouped[date]) grouped[date] = {};
    if (!grouped[date][a.source]) grouped[date][a.source] = 0;
    grouped[date][a.source]++;
  });

  const labels = Object.keys(grouped).sort();
  const sources = ["Call", "Meeting", "Demo", "Mail", "Whatsapp"];

  const datasets = sources.map((src, i) => ({
    label: src,
    data: labels.map((d) => grouped[d][src] || 0),
    borderColor: this.getColor(i),
    backgroundColor: this.getColor(i, 0.2),
    fill: false,
    tension: 0.3,
    borderWidth: 2,
    pointRadius: 4,
  }));

  this.setState({ lineData: { labels, datasets } });
};

buildBarChart = () => {
  const { activities, barGroup } = this.state;
  const sources = ["Call", "Meeting", "Demo", "Mail", "Whatsapp"];

  // Period → { source → count }
  const byPeriod = {};
  activities.forEach(a => {
    const { label, sort } = this.periodKey(a.date, barGroup);
    if (!byPeriod[label]) byPeriod[label] = { __sort: sort };
    const src = a.source || "Unknown";
    byPeriod[label][src] = (byPeriod[label][src] || 0) + 1;
  });

  // Sort periods chronologically
  const labels = Object.keys(byPeriod)
    .sort((a, b) => byPeriod[a].__sort - byPeriod[b].__sort);

  // Build stacked datasets (same hue, different brightness)
  const datasets = sources.map((src, i) => ({
    label: src,
    data: labels.map(p => byPeriod[p][src] || 0),
    backgroundColor: this.getShade(i, sources.length, 0.9),
    // Chart.js v2: same stack id for stacking
    stack: "one",
  }));

  this.setState({ barData: { labels, datasets } });
};



  getColor = (i, alpha = 1) => {
    const colors = [
      `rgba(99, 102, 241, ${alpha})`, // Indigo
      `rgba(34, 197, 94, ${alpha})`,  // Green
      `rgba(239, 68, 68, ${alpha})`,  // Red
      `rgba(234, 179, 8, ${alpha})`,  // Yellow
      `rgba(59, 130, 246, ${alpha})`, // Blue
    ];
    return colors[i % colors.length];
  };

  getGradient = (color) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    return gradient;
  };

  render() {
    const { lineData, barData, filter } = this.state;

    return (
      <div className="container mt-4">
        <Row>
          <Col md={12}>
            <Card className="p-3 shadow-sm bg-white border-0 mb-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                    <h5>Activities by Source over Time</h5>
                    <p>Daily count of activities split by source</p>
                </div>
                <ButtonGroup>
                  {["1D", "5D", "1M", "1Y"].map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={filter === f ? "primary" : "light"}
                      onClick={() =>
                        this.setState({ filter: f }, () => {
                          this.buildLineChart();
                          this.buildBarChart();
                        })
                      }
                    >
                      {f}
                    </Button>
                  ))}
                </ButtonGroup>

              </div>

              {lineData && (
                <Line
                  data={lineData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: "top" },
                      tooltip: {
                        mode: "index",
                        intersect: false,
                        backgroundColor: "#111827",
                        titleColor: "#fff",
                        bodyColor: "#fff",
                      },
                    },
                    interaction: { mode: "nearest", axis: "x", intersect: false },
                    scales: {
                      x: { grid: { display: false } },
                      y: { beginAtZero: true, grid: { color: "#f3f4f6" } },
                    },
                  }}
                  height={100}
                />
              )}
            </Card>
          </Col>

          <Col md={12}>
        <Card className="p-3 shadow-sm bg-white border-0">
  <div className="d-flex justify-content-between align-items-center mb-2">
    <div>
      <h5>Source Usage by Period (Stacked)</h5>
      <p className="mb-0">How each source was used per {this.state.barGroup.toLowerCase()}</p>
    </div>
    <select
      className="form-select w-auto"
      value={this.state.barGroup}
      onChange={(e) => this.setState({ barGroup: e.target.value }, this.buildBarChart)}
    >
      <option>Daily</option>
      <option>Weekly</option>
      <option>Monthly</option>
    </select>
  </div>

  {this.state.barData && (
    <Bar
      data={this.state.barData}
      options={{
        responsive: true,
        legend: { position: "top" },
        tooltips: { mode: "index", intersect: false },
        scales: {
          xAxes: [{ stacked: true, gridLines: { display: false } }],
          yAxes: [{ stacked: true, ticks: { beginAtZero: true, precision: 0 } }],
        },
      }}
      height={100}
    />
  )}
</Card>

          </Col>
        </Row>
      </div>
    );
  }
}

export default Dashboard;
