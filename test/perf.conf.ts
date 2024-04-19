import * as fs from "fs";
import * as path from "path";
import { performance } from "perf_hooks";

interface PerfResult {
  testName: string;
  duration: number;
  cpu: Cpu;
  memory: Memory;
}

interface Cpu {
  user: number;
  system: number;
}

interface Memory {
  average: number;
  peak: number;
}

class Baseline {
  memory: NodeJS.MemoryUsage | null = null;

  measure = () => {
    if (global.gc) {
      global.gc();
    }
    this.memory = process.memoryUsage();
  };
}

const results: PerfResult[] = [];

/**
 * Executes a function a specified number of times and measures the CPU usage, execution time, and memory usage.
 * This function is intended to help profile the performance of code blocks by capturing performance
 * metrics across multiple iterations to derive an average and peak statistic for both time and memory consumption.
 * The results are stored in a global results array which can be used for further analysis or reporting.
 *
 * <b>Understanding Memory Usage Values</b>
 *
 * Average Memory Usage: Calculated as the average heap memory used across certain checkpoints (i % 100 === 0).
 * Unit: The values are in megabytes. The heap memory used represents the amount of memory allocated for dynamic
 * variables and data structures within the V8 JavaScript engine's heap.
 *
 * Peak Memory Usage: The maximum heap memory usage observed at the same checkpoints.
 * Unit: Also measured in megabytes. Peak memory usage is critical for understanding the worst-case memory
 * requirements of the function, which can be particularly important in environments with limited
 * resources or when optimizing for memory efficiency.
 *
 * <b>Understanding CPU Usage Values</b>
 *
 * User Time: The time the CPU spends in user mode, executing the process (not the operating system), measured in milliseconds.
 *
 * System Time: The time the CPU spends in system mode on behalf of the process, measured in milliseconds.
 * These are derived from process.cpuUsage(), which provides the CPU time usage in microseconds. The values are then
 * converted to milliseconds for consistency with the duration measurement.
 *
 * @param {string} testName - The name of the test, used to identify the test in the results output.
 * @param {() => void} fn - The function to be tested. This function should encapsulate the operations whose
 * performance you wish to measure. It should not return any value.
 * @param {number} [iterations=1000] - The number of times the function `fn` should be executed. Default is 1000 iterations.
 * This parameter allows the user to specify the sample size for the test, providing flexibility in how thorough the testing should be.
 *
 * @returns {void} - This function does not return a value. It populates the global `results` array with the performance
 * metrics of the test, including the average and peak memory usage, as well as the average duration and CPU usage for the test.
 */
export const perf = (testName: string, fn: () => void, iterations: number = 1000): void => {
  const baseline = new Baseline();
  baseline.measure();

  const startCpu = process.cpuUsage();
  const start = performance.now();
  const memoryUsage: Memory[] = [];
  let peakMemory = 0;

  for (let i = 0; i < iterations; i++) {
    fn();
    if (i % 50 === 0) {
      const currentMemoryUsage = process.memoryUsage();
      const currentHeapUsed = (currentMemoryUsage.heapUsed - (baseline.memory?.heapUsed || 0)) / 1048576;
      memoryUsage.push({ average: currentHeapUsed, peak: currentHeapUsed });
      peakMemory = Math.max(peakMemory, currentHeapUsed);
    }
  }

  const end = performance.now();
  const endCpu = process.cpuUsage();
  const duration = Math.round(((end - start) / iterations) * 1000) / 1000;
  const cpuUsage = {
    user: Math.round(((endCpu.user - startCpu.user) / 1000) * 100) / 100,
    system: Math.round(((endCpu.system - startCpu.system) / 1000) * 100) / 100,
  };

  const averageMemoryUsage = memoryUsage.reduce((acc, usage) => acc + usage.average, 0) / memoryUsage.length;

  results.push({
    testName,
    duration,
    cpu: cpuUsage,
    memory: {
      average: Math.round(averageMemoryUsage * 100) / 100,
      peak: Math.round(peakMemory * 100) / 100,
    },
  });
};

export const save = () => {
  const resultsDir = path.resolve(__dirname, "../results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }
  const date = new Date().getTime();
  fs.writeFileSync(path.join(resultsDir, `performance.${date}.json`), JSON.stringify(results, null, 2));
};
