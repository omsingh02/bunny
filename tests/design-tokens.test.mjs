import { CdpClient } from './helpers/cdp-client.mjs';

const DISALLOWED_COLORS = [
    { name: 'Browser Default Black', rgb: 'rgb(0, 0, 0)' },
    { name: 'Un-themed Charcoal Black Fallback', rgb: 'rgb(19, 52, 59)' },
    { name: 'Corporate Teal 500', rgb: 'rgb(33, 128, 141)' },
    { name: 'Corporate Teal 300', rgb: 'rgb(50, 184, 198)' },
    { name: 'Corporate Teal 400', rgb: 'rgb(45, 166, 178)' },
];

export async function runDesignTokenTests(baseUrl) {
    const results = {
        name: 'Design Tokens & Computed Style Conformance Test',
        passed: false,
        violations: []
    };

    const client = new CdpClient({ port: 9334 });

    try {
        await client.launch(baseUrl, { width: 1920, height: 1080, isMobile: false });
        await client.waitFor('!!window.game?.bunny && !!window.game?.soundEffects?.jump', 10000);

        // 1. Audit CSS Custom Properties on document.documentElement across theme environments
        const themeEnvironments = [
            { name: 'Default Scheme', action: async () => {
                await client.emulateColorScheme('none');
                await client.evaluate(`document.documentElement.removeAttribute('data-color-scheme')`);
            }},
            { name: 'OS Dark Mode (prefers-color-scheme: dark)', action: async () => {
                await client.emulateColorScheme('dark');
                await client.evaluate(`document.documentElement.removeAttribute('data-color-scheme')`);
            }},
            { name: 'Explicit [data-color-scheme="dark"]', action: async () => {
                await client.emulateColorScheme('none');
                await client.evaluate(`document.documentElement.setAttribute('data-color-scheme', 'dark')`);
            }},
            { name: 'Explicit [data-color-scheme="light"]', action: async () => {
                await client.emulateColorScheme('none');
                await client.evaluate(`document.documentElement.setAttribute('data-color-scheme', 'light')`);
            }}
        ];

        for (const env of themeEnvironments) {
            await env.action();
            await client.waitFor(200);

            const tokenAudit = await client.evaluate(`
                (() => {
                    const style = window.getComputedStyle(document.documentElement);
                    const primary = style.getPropertyValue('--color-primary').trim();
                    const primaryHover = style.getPropertyValue('--color-primary-hover').trim();
                    const focusRing = style.getPropertyValue('--color-focus-ring').trim();
                    const issues = [];

                    if (primary.includes('teal') || primary.includes('33, 128, 141') || primary.includes('50, 184, 198')) {
                        issues.push({ token: '--color-primary', value: primary });
                    }
                    if (primaryHover.includes('teal') || primaryHover.includes('45, 166, 178')) {
                        issues.push({ token: '--color-primary-hover', value: primaryHover });
                    }
                    if (focusRing.includes('teal') || focusRing.includes('33, 128, 141') || focusRing.includes('50, 184, 198')) {
                        issues.push({ token: '--color-focus-ring', value: focusRing });
                    }
                    return issues;
                })()
            `);

            if (tokenAudit && tokenAudit.length > 0) {
                for (const issue of tokenAudit) {
                    results.violations.push({
                        context: env.name,
                        element: ':root',
                        tag: 'css-token',
                        rule: 'Teal Token Leak in Theme',
                        detail: `${issue.token} resolved to ${issue.value}`
                    });
                }
            }
        }

        // Reset theme to default for screen element audits
        await client.emulateColorScheme('none');
        await client.evaluate(`document.documentElement.removeAttribute('data-color-scheme')`);

        // 2. Audit All UI Screens (Menu, Running HUD with #pause-btn, Settings Modal, Game Over)
        const screenAudits = [
            {
                name: 'Active Game HUD (In-Game Running)',
                prepare: async () => {
                    await client.evaluate(`window.game.startGame()`);
                    await client.waitFor(500);
                }
            },
            {
                name: 'Pause State',
                prepare: async () => {
                    await client.evaluate(`window.game.pauseGame()`);
                    await client.waitFor(300);
                }
            },
            {
                name: 'Game Over Screen',
                prepare: async () => {
                    await client.evaluate(`window.game.gameOver()`);
                    await client.waitFor(300);
                }
            }
        ];

        for (const screen of screenAudits) {
            await screen.prepare();

            const elementAudit = await client.evaluate(`
                (() => {
                    const disallowed = ${JSON.stringify(DISALLOWED_COLORS)};
                    const violations = [];
                    // Query all visible buttons, links, hud controls
                    const elements = Array.from(document.querySelectorAll('button, .btn, .hud-controls button, .recommended-badge, .score-big'));

                    elements.forEach(el => {
                        // Check if element or its parent is rendered (offsetParent !== null or position fixed/absolute)
                        const style = window.getComputedStyle(el);
                        if (style.display === 'none' || style.visibility === 'hidden') return;

                        const id = el.id || el.className || el.textContent.trim().slice(0, 20);

                        for (const dc of disallowed) {
                            if (style.color === dc.rgb) {
                                violations.push({
                                    element: id,
                                    tag: el.tagName.toLowerCase(),
                                    rule: 'Disallowed Text Color',
                                    detail: 'Resolved to ' + dc.name + ' (' + style.color + ')',
                                    html: el.outerHTML.slice(0, 100)
                                });
                            }
                        }

                        // Check box shadow for teal leaks
                        if (style.boxShadow && (style.boxShadow.includes('33, 128, 141') || style.boxShadow.includes('50, 184, 198'))) {
                            violations.push({
                                element: id,
                                tag: el.tagName.toLowerCase(),
                                rule: 'Teal Box Shadow Leak',
                                detail: 'box-shadow: ' + style.boxShadow,
                                html: el.outerHTML.slice(0, 100)
                            });
                        }
                    });

                    return violations;
                })()
            `);

            if (elementAudit && elementAudit.length > 0) {
                for (const v of elementAudit) {
                    results.violations.push({ context: screen.name, ...v });
                }
            }
        }

        // 3. Audit Mobile HUD (#pause-btn squircle / styling on mobile)
        await client.launch(`${baseUrl}/mobile/index.html`, { width: 390, height: 844, isMobile: true });
        await client.waitFor('!!window.game?.bunny && !!window.game?.soundEffects?.jump', 10000);
        await client.evaluate(`window.game.startGame()`);
        await client.waitFor(500);

        const mobileHudAudit = await client.evaluate(`
            (() => {
                const disallowed = ${JSON.stringify(DISALLOWED_COLORS)};
                const violations = [];
                const buttons = Array.from(document.querySelectorAll('.hud-controls button, #pause-btn'));

                buttons.forEach(el => {
                    const style = window.getComputedStyle(el);
                    const id = el.id || el.className;

                    for (const dc of disallowed) {
                        if (style.color === dc.rgb) {
                            violations.push({
                                element: id,
                                tag: el.tagName.toLowerCase(),
                                rule: 'Disallowed Text Color (Mobile HUD)',
                                detail: 'Resolved to ' + dc.name + ' (' + style.color + ')',
                                html: el.outerHTML.slice(0, 100)
                            });
                        }
                    }
                });

                return violations;
            })()
        `);

        if (mobileHudAudit && mobileHudAudit.length > 0) {
            for (const v of mobileHudAudit) {
                results.violations.push({ context: 'Mobile HUD (390x844)', ...v });
            }
        }

    } finally {
        await client.close();
    }

    results.passed = results.violations.length === 0;
    return results;
}
