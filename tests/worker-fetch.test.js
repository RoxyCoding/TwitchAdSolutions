const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const master = 'https://usher.example/channel/hls/live.m3u8?token=test';
const variant = 'https://cdn.example/variant?quality=source';
const manifest = '#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=640x360,CODECS="avc1"\n' + variant;

for (const family of ['vaft', 'video-swap-new']) {
    const dir = path.join(__dirname, '..', family);
    for (const name of fs.readdirSync(dir).filter(name => name.startsWith(family) && name.endsWith('.js'))) {
        test(name, { timeout: 2000 }, async () => {
            const source = fs.readFileSync(path.join(dir, name), 'utf8')
                .replace(/^twitch-videoad\.js text\/javascript\r?\n/, '');
            new vm.Script(source);
            const calls = [];
            let masterBody = manifest;
            let reply = url => new Response(url === master ? masterBody : 'media');
            const worker = vm.createContext({
                URL, Response, Blob, atob, console,
                AdSegmentCache: new Map(), StreamInfos: {}, StreamInfosByUrl: {},
                OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE: false, ForceAccessTokenPlayerType: false,
                AlwaysReloadPlayerOnAd: false, SimulatedAdsDepth: 0,
                videoCodecFamily: () => 'avc', hasAdTags: () => false,
                processM3U8: (_, body) => 'processed ' + body,
                getServerTimeFromM3u8: () => '123', replaceServerTimeInM3u8: text => text,
                fetch: async url => { calls.push(url); return reply(url); },
            });
            const functions = ['createStreamInfo', 'parseAttributes', 'hookWorkerFetch'];
            if (family === 'video-swap-new') functions.push('setStreamInfoUrls');
            for (const fn of functions) {
                const start = source.indexOf('    function ' + fn + '(');
                assert.notEqual(start, -1);
                const end = source.indexOf('\n    }', start);
                vm.runInContext(source.slice(start, end + 6), worker);
            }
            worker.hookWorkerFetch();
            masterBody = '#EXTM3U';
            assert.equal(await (await worker.fetch(master)).text(), masterBody);
            masterBody = manifest;
            assert.equal(await (await worker.fetch(master)).text(), manifest);
            assert.equal(await (await worker.fetch(variant)).text(), 'processed media');
            calls.length = 0;
            await worker.fetch(master);
            assert.ok(calls.includes(variant));
            const segment = 'https://cdn.example/segment.ts';
            assert.equal(await (await worker.fetch(segment)).text(), 'media');
            reply = () => ({status: 200, text: async () => { throw Error('body failed'); }});
            await assert.rejects(worker.fetch(variant), /body failed/);
            reply = () => { throw Error('network failed'); };
            await assert.rejects(worker.fetch(master), /network failed/);
        });
    }
}
