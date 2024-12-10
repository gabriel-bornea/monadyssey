import * as fs from "fs";
import * as path from "path";

interface PerfResult {
  testName: string;
  durations: number[];
  cpuUsages: Cpu[];
  memoryUsages: Memory[];
}

interface Cpu {
  user: number;
  system: number;
}

interface Memory {
  heapUsed: number;
  rss: number;
}

class Baseline {
  memory: NodeJS.MemoryUsage | null = null;

  measure = () => {
    this.memory = process.memoryUsage();
  };
}

const results: PerfResult[] = [];

export const perf = (testName: string, fn: () => void, iterations: number = 1000): void =>
  Simulation.execute(testName, fn, iterations);

export const save = (type: string) => Simulation.exportAsJson(type);

export const html = (type: string) => Simulation.exportAsHtml(type);

class Simulation {
  private static resultsDir = path.resolve(__dirname, "../../results");
  private static jsonResultsDir = path.join(Simulation.resultsDir, "json");
  private static htmlResultsDir = path.join(Simulation.resultsDir, "html");

  static average = (array: number[], bins: number): number[] => {
    const binSize = Math.ceil(array.length / bins);
    return Array.from({ length: bins }, (_, i) => {
      const start = i * binSize;
      const end = Math.min(start + binSize, array.length);
      const bin = array.slice(start, end);
      return bin.reduce((sum, value) => sum + value, 0) / bin.length;
    });
  };

  static averageCpu = (array: Cpu[], bins: number): Cpu[] => {
    const binSize = Math.ceil(array.length / bins);
    return Array.from({ length: bins }, (_, i) => {
      const start = i * binSize;
      const end = Math.min(start + binSize, array.length);
      const bin = array.slice(start, end);
      return {
        user: bin.reduce((sum, value) => sum + value.user, 0) / bin.length,
        system: bin.reduce((sum, value) => sum + value.system, 0) / bin.length,
      };
    });
  };

  static averageMem = (array: Memory[], bins: number): Memory[] => {
    const binSize = Math.ceil(array.length / bins);
    return Array.from({ length: bins }, (_, i) => {
      const start = i * binSize;
      const end = Math.min(start + binSize, array.length);
      const bin = array.slice(start, end);
      return {
        heapUsed: bin.reduce((sum, value) => sum + value.heapUsed, 0) / bin.length,
        rss: bin.reduce((sum, value) => sum + value.rss, 0) / bin.length,
      };
    });
  };

  static execute = (testName: string, fn: () => void, iterations: number = 1000): void => {
    const baseline = new Baseline();

    const durations: number[] = [];
    const cpuUsages: Cpu[] = [];
    const memoryUsages: Memory[] = [];

    for (let i = 0; i < iterations; i++) {
      baseline.measure();

      const startCpu = process.cpuUsage();
      const start = performance.now();

      fn();

      const end = performance.now();
      const endCpu = process.cpuUsage(startCpu);

      const duration = end - start;
      const cpuUsage = {
        user: endCpu.user / 1000,
        system: endCpu.system / 1000,
      };
      const currentMemoryUsage = process.memoryUsage();
      const memoryUsage = {
        heapUsed: Math.max(0, Math.round((currentMemoryUsage.heapUsed - (baseline.memory?.heapUsed || 0)) / 1024)),
        rss: Math.max(0, Math.round((currentMemoryUsage.rss - (baseline.memory?.rss || 0)) / 1024)),
      };

      durations.push(duration);
      cpuUsages.push(cpuUsage);
      memoryUsages.push(memoryUsage);
    }

    results.push({
      testName,
      durations,
      cpuUsages,
      memoryUsages,
    });
  };

  static exportAsJson = (type: string) => {
    if (!fs.existsSync(Simulation.jsonResultsDir)) {
      fs.mkdirSync(Simulation.jsonResultsDir, { recursive: true });
    }
    const date = new Date().getTime();
    fs.writeFileSync(
      path.join(Simulation.jsonResultsDir, `performance.${type}.${date}.json`),
      JSON.stringify(results, null, 2)
    );
  };

  static exportAsHtml = (type: string) => {
    if (!fs.existsSync(Simulation.htmlResultsDir)) {
      fs.mkdirSync(Simulation.htmlResultsDir, { recursive: true });
    }
    const date = new Date().getTime();
    const content = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Performance results for ${type}</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          * {
            font-family: "Gill Sans", sans-serif;
          }
          .chart-row {
            display: flex;
            justify-content: space-around;
            margin-bottom: 50px;
          }
          .chart-container {
            width: 30%;
          }
        </style>
      </head>
      <body>
        <h1>Performance results for ${type} data type</h1>
        ${results
          .map((result, index) => {
            const checkpoints: number = 10;
            const averagedDurations = Simulation.average(result.durations, checkpoints);
            const averagedCpuUsages = Simulation.averageCpu(result.cpuUsages, checkpoints);
            const averagedMemoryUsages = Simulation.averageMem(result.memoryUsages, checkpoints);

            return `
              <div class="chart-row">
                <div class="chart-container">
                  <h2><span style="font-family: monospace">${result.testName}</span> <span style="font-weight: normal; color: #666666">simulation</span></h2>
                  <canvas id="durationChart${index}" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                  <h2 style="color: transparent">${result.testName} Simulation</h2>
                  <canvas id="cpuChart${index}" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                  <h2 style="color: transparent">${result.testName} Simulation</h2>
                  <canvas id="memoryChart${index}" width="400" height="200"></canvas>
                </div>
              </div>
              <script>
                const ctxDuration${index} = document.getElementById('durationChart${index}').getContext('2d');
                const ctxCpu${index} = document.getElementById('cpuChart${index}').getContext('2d');
                const ctxMemory${index} = document.getElementById('memoryChart${index}').getContext('2d');

                new Chart(ctxDuration${index}, {
                  type: 'line',
                  data: {
                    labels: ${JSON.stringify(Array.from({ length: checkpoints }, (_, i) => i + 1))},
                    datasets: [{
                      label: 'Duration (ms)',
                      data: ${JSON.stringify(averagedDurations)},
                      borderColor: 'rgba(75, 192, 192, 1)',
                      backgroundColor: 'rgba(75, 192, 192, 0.2)',
                      fill: false
                    }]
                  },
                  options: {
                    plugins: {
                      title: {
                        display: true,
                        text: 'Duration Over Time'
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true
                      },
                      x: {
                        title: {
                          display: true,
                          text: 'Checkpoints'
                        }
                      }
                    }
                  }
                });

                new Chart(ctxCpu${index}, {
                  type: 'line',
                  data: {
                    labels: ${JSON.stringify(Array.from({ length: checkpoints }, (_, i) => i + 1))},
                    datasets: [{
                      label: 'CPU User (ms)',
                      data: ${JSON.stringify(averagedCpuUsages.map((cpu) => cpu.user))},
                      borderColor: 'rgba(255, 99, 132, 1)',
                      backgroundColor: 'rgba(255, 99, 132, 0.2)',
                      fill: false
                    }, {
                      label: 'CPU System (ms)',
                      data: ${JSON.stringify(averagedCpuUsages.map((cpu) => cpu.system))},
                      borderColor: 'rgba(54, 162, 235, 1)',
                      backgroundColor: 'rgba(54, 162, 235, 0.2)',
                      fill: false
                    }]
                  },
                  options: {
                    plugins: {
                      title: {
                        display: true,
                        text: 'CPU Usage Over Time'
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true
                      },
                      x: {
                        title: {
                          display: true,
                          text: 'Checkpoints'
                        }
                      }
                    }
                  }
                });

                new Chart(ctxMemory${index}, {
                  type: 'line',
                  data: {
                    labels: ${JSON.stringify(Array.from({ length: checkpoints }, (_, i) => i + 1))},
                    datasets: [{
                      label: 'Memory Heap Used (KB)',
                      data: ${JSON.stringify(averagedMemoryUsages.map((memory) => memory.heapUsed))},
                      borderColor: 'rgba(153, 102, 255, 1)',
                      backgroundColor: 'rgba(153, 102, 255, 0.2)',
                      fill: false
                    }, {
                      label: 'Memory RSS (KB)',
                      data: ${JSON.stringify(averagedMemoryUsages.map((memory) => memory.rss))},
                      borderColor: 'rgba(255, 206, 86, 1)',
                      backgroundColor: 'rgba(255, 206, 86, 0.2)',
                      fill: false
                    }]
                  },
                  options: {
                    plugins: {
                      title: {
                        display: true,
                        text: 'Memory Usage Over Time'
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true
                      },
                      x: {
                        title: {
                          display: true,
                          text: 'Checkpoints'
                        }
                      }
                    }
                  }
                });
              </script>
            `;
          })
          .join("")}
      </body>
      </html>
    `;
    fs.writeFileSync(path.join(Simulation.htmlResultsDir, `performance.${type}.${date}.html`), content);
  };
}
