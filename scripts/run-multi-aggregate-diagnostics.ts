import path from "node:path";

import { runMultiAggregateDiagnostics } from "@/server/experiment/metrics";

type CliArgs = {
    experimentDir: string;
    outputDir?: string;
};

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const { result, paths } = await runMultiAggregateDiagnostics(args);

    const total = result.perRun.reduce(
        (acc, row) => ({
            multiWins: acc.multiWins + (row.outcome === "multi_wins" ? 1 : 0),
            singleWins: acc.singleWins + (row.outcome === "single_wins" ? 1 : 0),
            practicalTies: acc.practicalTies + (row.outcome === "practical_tie" ? 1 : 0),
        }),
        { multiWins: 0, singleWins: 0, practicalTies: 0 }
    );

    console.log(`Experiment: ${result.experimentId}`);
    console.log(`Output dir: ${path.relative(process.cwd(), paths.outputDir)}`);
    console.log(`Pairs found: ${result.pairCount}`);
    console.log(`Missing pairs: ${result.missingPairs.length}`);
    console.log(`Multi wins: ${total.multiWins}`);
    console.log(`Single wins: ${total.singleWins}`);
    console.log(`Practical ties: ${total.practicalTies}`);
    console.log(`Internal data warnings: ${result.internalDataWarnings.length}`);
    console.log("");
    console.log(`Summary: ${path.relative(process.cwd(), paths.summaryMd)}`);
}

function parseArgs(argv: string[]): CliArgs {
    const experimentDir = readOption(argv, "--experiment-dir") ?? readOption(argv, "-d");
    const outputDir = readOption(argv, "--output-dir");

    if (!experimentDir) {
        throw new Error(
            "Usage: npm run run:multi-aggregate-diagnostics -- --experiment-dir <experiments/results/experiment-runs/<id>> [--output-dir <dir>]"
        );
    }

    return {
        experimentDir,
        ...(outputDir && { outputDir }),
    };
}

function readOption(argv: string[], name: string): string | undefined {
    const index = argv.indexOf(name);
    if (index === -1) return undefined;
    return argv[index + 1];
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
