// reload + liveEdit pins (reload-to-dev D), jest wrapper: the real pin
// logic lives in ws-reload.child.js and runs in a PLAIN node child process —
// jest's sandboxed realm cannot address Node's module cache (Module._cache),
// which the reload op works on; the child shares that world with the
// payload. This wrapper only requires a green child and the final marker.
import { execFile } from 'node:child_process';
import { join } from 'node:path';

describe('ws reload + liveEdit (module reload, Mode 2)', () => {
	jest.setTimeout(60_000);

	test('all pins pass in a plain-node child (see ws-reload.child.js)', (done) => {
		const child = join(__dirname, 'ws-reload.child.js');
		execFile(process.execPath, [child], { timeout: 55_000 }, (err, stdout, stderr) => {
			const lines = stdout.trim().split('\n').filter(Boolean);
			for (const line of lines) {
				// eslint-disable-next-line no-console
				console.log('[child]', line);
			}
			if (stderr) {
				// eslint-disable-next-line no-console
				console.log('[child stderr]', stderr.slice(0, 500));
			}
			expect(err).toBeNull();
			expect(lines.some((l) => l.includes('ALL PINS PASSED'))).toBe(true);
			done();
		});
	});
});
