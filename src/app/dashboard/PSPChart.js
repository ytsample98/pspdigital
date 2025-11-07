import React from "react";
import { Bar } from "react-chartjs-2";


export const PSPChart = ({ dashdata = [] }) => {

  const months = dashdata.map((item) => item.month);
  const cardsRaised = dashdata.map((item) => item.raised);
  const cardsClosed = dashdata.map((item) => item.closed);
  const closurePercent = dashdata.map((item) => item.competency);

  const data = {
    labels: months,
    datasets: [
      {
        label: "Cards Raised",
        type: "bar",
        backgroundColor: "rgba(255, 205, 86, 0.8)",
        data: cardsRaised,
        yAxisID: "y-axis-left",
      },
      {
        label: "Cards Closed",
        type: "bar",
        backgroundColor: "rgba(75, 192, 192, 0.8)",
        data: cardsClosed,
        yAxisID: "y-axis-left",
      },
      {
        label: "YTD Closure %",
        type: "line",
        fill: false,
        borderColor: "#36A2EB",
        backgroundColor: "#36A2EB",
        data: closurePercent,
        yAxisID: "y-axis-right",
      },
    ],
  };

  const options = {
    responsive: true,
    legend: { position: "top" },
    scales: {
      yAxes: [
        {
          id: "y-axis-left",
          type: "linear",
          position: "left",
          ticks: {
            min: 0,
            max: 60,
            stepSize: 5,
          },
          scaleLabel: {
            display: true,
            labelString: "Cards",
          },
        },
        {
          id: "y-axis-right",
          type: "linear",
          position: "right",
          ticks: {
            min: 0,
            max: 100,
            stepSize: 20,
            callback: (value) => value + "%",
          },
          scaleLabel: {
            display: true,
            labelString: "Closure (%)",
          },
          gridLines: {
            drawOnChartArea: false,
          },
        },
      ],
      xAxes: [
        {
          scaleLabel: {
            display: true,
            labelString: "Months",
          },
        },
      ],
    },
    plugins: {
      datalabels: {
        display: true,
        color: "#000",
        font: {
          weight: "bold",
        },
        align: "end",
        anchor: "end",
        formatter: function (value, context) {
          const datasetLabel = context.dataset.label;
          return datasetLabel === "YTD Closure %" ? value + "%" : value;
        },
      },
    },
  };

  return (
    <div style={{ width: "85%", margin: "auto" }}>
      <h3 style={{ textAlign: "center" }}>PSP Closer Status Dashboard</h3>
      <Bar data={data} options={options} />
    </div>
  );
};

export default PSPChart;
