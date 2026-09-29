// Live-patch pins (reload-to-dev step 1): the ws `patch` op replaces an
// existing type's construct handler in flight — the next construction runs
// the new handler, previously built instances keep their data, rollback
// restores the exact original, subtype paths work, the TypeProxy/shared
// InstanceCreator is never written, and unknown paths fail readably.
import { define, lookup, SymbolParentType } from 'mnemonica';
import type { TypeConstructor } from 'mnemonica';
import { startStrategyClient, type StrategyClientHandle } from '../src/client';
import { WSSession } from '../src/ws-session';

interface WidgetInstance { value : number }
interface RootInstance {
	kind    : string;
	PatchSub : TypeConstructor<SubInstance>;
}
interface SubInstance extends RootInstance { sub : string }
interface OtherInstance { o : number }
interface UrlWidgetInstance { tag : string }

const PatchWidget = define('PatchWidget', function (this : WidgetInstance, v : number) {
	this.value = v;
});
const PatchRoot = define('PatchRoot', function (this : RootInstance) {
	this.kind = 'root';
});
PatchRoot.define('PatchSub', function (this : SubInstance) {
	this.sub = 'old';
});
const PatchOther = define('PatchOther', function (this : OtherInstance) {
	this.o = 1;
});
const PatchURLWidget = define('PatchURLWidget', function (this : UrlWidgetInstance) {
	this.tag = 'orig';
});

describe('ws patch (live handler replacement)', () => {
	let handle : StrategyClientHandle;
	let session : WSSession;

	beforeAll(async () => {
		handle = await startStrategyClient();
		session = await WSSession.connect('127.0.0.1', handle.port, handle.token);
	});

	afterAll(async () => {
		session.close();
		await handle.stop();
	});

	test('patch redirects the next construction; the prior instance keeps its data', async () => {
		const before = new PatchWidget(2);
		expect(before.value).toBe(2);

		const patched = await session.request('patch', {
			path : 'PatchWidget',
			body : 'function (v) { this.value = v * 2; }'
		});
		expect(patched).toMatchObject({ path: 'PatchWidget', patches: 1 });

		expect(new PatchWidget(2).value).toBe(4);
		expect(before.value).toBe(2);
	});

	test('rollback restores the exact original — including across re-patches', async () => {
		await session.request('rollback', { path: 'PatchWidget' });
		expect(new PatchWidget(2).value).toBe(2);

		await session.request('patch', {
			path : 'PatchWidget',
			body : 'function (v) { this.value = v * 3; }'
		});
		expect(new PatchWidget(2).value).toBe(6);

		await session.request('rollback', { path: 'PatchWidget' });
		expect(new PatchWidget(2).value).toBe(2);
	});

	test('a SUBTYPE path patches through the raw descriptor', async () => {
		const root = new PatchRoot();
		const subBefore = new root.PatchSub();
		expect(subBefore.sub).toBe('old');

		await session.request('patch', {
			path : 'PatchRoot.PatchSub',
			body : 'function () { this.sub = "new"; }'
		});
		const subAfter = new root.PatchSub();
		expect(subAfter.sub).toBe('new');
		expect(subBefore.sub).toBe('old');
		expect(subAfter.kind).toBe('root'); // parent fields intact

		await session.request('rollback', { path: 'PatchRoot.PatchSub' });
		expect(new root.PatchSub().sub).toBe('old');
	});

	test('the TypeProxy and the shared InstanceCreator are never written', async () => {
		await session.request('patch', {
			path : 'PatchWidget',
			body : 'function (v) { this.value = v * 5; }'
		});

		const proxy = lookup('PatchWidget');
		expect(Object.prototype.hasOwnProperty.call(proxy, 'constructHandler')).toBe(false);

		// the raw descriptor carries the factory; the shared machinery is fine
		const desc = (lookup('PatchWidget') as { subtypes : object })[
			'subtypes' as never
		] as Record<symbol, { constructHandler : unknown }>;
		expect(Object.prototype.hasOwnProperty.call(desc[SymbolParentType], 'constructHandler')).toBe(true);

		// unrelated types construct untouched
		expect(new PatchOther().o).toBe(1);

		await session.request('rollback', { path: 'PatchWidget' });
		expect(new PatchWidget(2).value).toBe(2);
	});

	test('rollback pops ONE step — two patches, one rollback keeps the first patch', async () => {
		await session.request('patch', { path: 'PatchWidget', body: 'function (v) { this.value = v * 2; }' });
		await session.request('patch', { path: 'PatchWidget', body: 'function (v) { this.value = v * 3; }' });
		expect(new PatchWidget(2).value).toBe(6);

		const popped = await session.request('rollback', { path: 'PatchWidget' }) as { depth : number };
		expect(popped.depth).toBe(1);
		expect(new PatchWidget(2).value).toBe(4);   // the FIRST patch is active again

		await session.request('rollback', { path: 'PatchWidget' });
		expect(new PatchWidget(2).value).toBe(2);   // stack emptied -> original

		// rollback { path, all: true } jumps straight to the original
		await session.request('patch', { path: 'PatchWidget', body: 'function (v) { this.value = v * 7; }' });
		await session.request('patch', { path: 'PatchWidget', body: 'function (v) { this.value = v * 8; }' });
		await session.request('rollback', { path: 'PatchWidget', all: true });
		expect(new PatchWidget(2).value).toBe(2);

		// rollback to the original removes the record entirely
		const list = await session.request('patched', {}) as { patched : Array<{ path : string; depth : number; sources : string[] }> };
		expect(list.patched.find((e) => e.path === 'PatchWidget')).toBeUndefined();

		// a fresh patch starts a new stack and lists depth + sources
		await session.request('patch', { path: 'PatchWidget', body: 'function (v) { this.value = v * 2; }' });
		const relisted = await session.request('patched', {}) as { patched : Array<{ path : string; depth : number; sources : string[] }> };
		const widget = relisted.patched.find((e) => e.path === 'PatchWidget')!;
		expect(widget.depth).toBe(1);
		expect(widget.sources.length).toBe(1);
		await session.request('rollback', { path: 'PatchWidget' });
	});

	test('an unknown path fails with a readable error', async () => {
		await expect(
			session.request('patch', { path: 'NoSuchType', body: 'function () {}' })
		).rejects.toThrow(/type not found/);
	});

	test('patched lists paths with patch counts; rollback all clears', async () => {
		await session.request('patch', { path: 'PatchWidget', body: 'function (v) { this.value = v + 1; }' });
		await session.request('patch', { path: 'PatchWidget', body: 'function (v) { this.value = v + 2; }' });

		const list = await session.request('patched', {}) as { patched : Array<{ path : string; patches : number }> };
		const widget = list.patched.find((e) => e.path === 'PatchWidget')!;
		expect(widget.patches).toBe(2);
		expect(new PatchWidget(2).value).toBe(4);

		const rolled = await session.request('rollback', { all: true }) as { rolledBack : string[] };
		expect(rolled.rolledBack).toContain('PatchWidget');
		expect(new PatchWidget(2).value).toBe(2);
	});

	test('every patch gets an automatic, unique sourceURL per version', async () => {
		// a caller-provided sourceURL is stripped — the automatic unique one wins
		const first = await session.request('patch', {
			path: 'PatchURLWidget',
			body: 'function () { this.tag = "v1"; }\n//# sourceURL=my-own-name.js'
		}) as { patches : number; sourceURL : string };
		expect(first.sourceURL).toBe('strategy-patch/PatchURLWidget@1.js');
		expect(first.patches).toBe(1);
		expect(new PatchURLWidget().tag).toBe('v1');

		const second = await session.request('patch', {
			path: 'PatchURLWidget',
			body: 'function () { this.tag = "v2"; }'
		}) as { patches : number; sourceURL : string };
		expect(second.sourceURL).toBe('strategy-patch/PatchURLWidget@2.js');
		expect(new PatchURLWidget().tag).toBe('v2');

		const list = await session.request('patched', {}) as {
			patched : Array<{ path : string; sources : string[] }>;
		};
		const entry = list.patched.find((e) => e.path === 'PatchURLWidget')!;
		expect(entry.sources.length).toBe(2);
		// the annotated body is recorded: one sourceURL each, the caller's gone
		entry.sources.forEach((source, i) => {
			expect(source).toContain('strategy-patch/PatchURLWidget@' + (i + 1) + '.js');
			expect(source.match(/sourceURL=/g)!.length).toBe(1);
		});
		expect(entry.sources[0]!).not.toContain('my-own-name');

		await session.request('rollback', { all: true });
		expect(new PatchURLWidget().tag).toBe('orig');
	});
});
