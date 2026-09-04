import path from 'path';
import { fileURLToPath } from 'url';
import { startStaticServer } from './helpers/static-server.mjs';
import { runPhysicsFramerateTests } from './physics-framerate.test.mjs';
import { runStateMemoryTests } from './state-memory.test.mjs';
import { runDesignTokenTests } from './design-tokens.test.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
};

async function main() {
    console.log(`\n${COLORS.bold}${COLORS.cyan}====================================================${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.cyan}     BUNNY RUNNER - PRODUCTION VERIFICATION SUITE   ${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.cyan}====================================================${COLORS.reset}\n`);

    console.log(`${COLORS.dim}Starting embedded test server at ${ROOT_DIR}...${COLORS.reset}`);
    const server = await startStaticServer(ROOT_DIR);
    console.log(`${COLORS.green}✔${COLORS.reset} Server listening at ${COLORS.cyan}${server.url}${COLORS.reset}\n`);

    const allSuites = [
        { name: 'Physics & Multi-Framerate Invariance', fn: runPhysicsFramerateTests },
        { name: 'State Transitions & WebGL Memory Lifecycle', fn: runStateMemoryTests },
        { name: 'Design Tokens & Computed Style Conformance', fn: runDesignTokenTests }
    ];

    let overallPassed = true;
    const summary = [];

    for (const suite of allSuites) {
        process.stdout.write(`Running: ${COLORS.bold}${suite.name}${COLORS.reset} ... `);
        try {
            const start = Date.now();
            const res = await suite.fn(server.url);
            const duration = ((Date.now() - start) / 1000).toFixed(2);

            if (res.passed) {
                console.log(`${COLORS.green}PASSED${COLORS.reset} ${COLORS.dim}(${duration}s)${COLORS.reset}`);
            } else {
                console.log(`${COLORS.red}FAILED${COLORS.reset} ${COLORS.dim}(${duration}s)${COLORS.reset}`);
                overallPassed = false;
            }
            summary.push({ ...res, duration });
        } catch (err) {
            console.log(`${COLORS.red}ERROR${COLORS.reset}`);
            console.error(err);
            overallPassed = false;
            summary.push({ name: suite.name, passed: false, error: err.message, violations: [err.message] });
        }
    }

    await server.stop();

    // Detailed Failure Reports
    console.log(`\n${COLORS.bold}---------------- DETAILED AUDIT RESULTS ----------------${COLORS.reset}\n`);

    for (const res of summary) {
        if (!res.passed && res.violations && res.violations.length > 0) {
            console.log(`${COLORS.red}${COLORS.bold}✖ ${res.name}:${COLORS.reset}`);
            res.violations.slice(0, 15).forEach((v, idx) => {
                if (typeof v === 'string') {
                    console.log(`   ${COLORS.yellow}${idx + 1}.${COLORS.reset} ${v}`);
                } else {
                    console.log(`   ${COLORS.yellow}${idx + 1}.${COLORS.reset} [${v.context || 'General'}] <${v.tag} id="${v.element}"> ${COLORS.red}${v.rule}${COLORS.reset}: ${v.detail}`);
                }
            });
            if (res.violations.length > 15) {
                console.log(`   ${COLORS.dim}... and ${res.violations.length - 15} more violations.${COLORS.reset}`);
            }
            console.log('');
        }
    }

    console.log(`${COLORS.bold}${COLORS.cyan}====================================================${COLORS.reset}`);
    if (overallPassed) {
        console.log(`${COLORS.bold}${COLORS.green}  ALL SUITES PASSED! Codebase satisfies contracts.  ${COLORS.reset}`);
    } else {
        console.log(`${COLORS.bold}${COLORS.red}  TEST SUITE FAILED. Invariants were violated.      ${COLORS.reset}`);
    }
    console.log(`${COLORS.bold}${COLORS.cyan}====================================================${COLORS.reset}\n`);

    process.exit(overallPassed ? 0 : 1);
}

main().catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
});
