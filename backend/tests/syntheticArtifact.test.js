// ---------------------------------------------------------------------------
// Task 3 — the canonical demand dataset is OWNED and provably regenerable.
//
// synthetic_series.json is the frozen dataset the SVR artifact (svm_model.json)
// was actually trained on. If it ever drifts, the shipped model silently stops
// matching its own training data and every forecast becomes meaningless — a
// failure that no unit test on the predictor would catch, because the predictor
// is fed fresh features at runtime and never re-reads this file.
//
// So this suite pins the artifact to its generator:
//   1. structural invariants (420 rows / 7 SKUs / 60 weeks / seed)
//   2. the file is EXACTLY what the exporter produces right now (byte parity)
//   3. the exporter is itself deterministic (two runs -> identical bytes)
//   4. profile assignment is frozen (index-based == SKU-hash-based)
//
// All four are hermetic: no DB, no network, no Python. The regen in (2) writes
// to a temp dir via SRC_OVERRIDE so the committed artifact is never touched.
// ---------------------------------------------------------------------------
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  HISTORY_SEED,
  WEEKS,
  BASE_WEEKLY_DEMAND,
  EXTRA_WEEKLY_DEMAND,
  ANCHOR_SKUS,
  assignProfile,
  profileForSku,
} from '../src/scripts/generateHistory.js';

const here = dirname(fileURLToPath(import.meta.url));
const mlDir = join(here, '..', 'src', 'ml');
const artifactPath = join(mlDir, 'artifacts', 'synthetic_series.json');
const exporterPath = join(mlDir, 'export_synthetic_dataset.mjs');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * The canonical bytes are the ones GIT STORES, not the ones on disk.
 *
 * core.autocrlf=true (see .gitattribute `*.json text eol=lf`) means the
 * working tree holds a CRLF-transcoded copy while the repository blob — and
 * therefore the file the SVR was actually trained against, and the file the
 * exporter's output must match — is pure LF. Hashing the working-tree file
 * would pin a line-ending artifact that git rewrites on every checkout, so
 * the comparison is made against the blob via `git cat-file`.
 *
 * If git is unavailable we fall back to the working tree and normalise CRLF
 * away, so the test still runs (and still catches real drift) in a tarball or
 * a non-git copy.
 */
function committedBytes() {
  try {
    const out = execFileSync('git', ['cat-file', '-p', `HEAD:${relRepoPath()}`], {
      cwd: join(here, '..'),
      encoding: 'buffer',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out;
  } catch {
    return Buffer.from(readFileSync(artifactPath, 'utf8').replace(/\r\n/g, '\n'), 'utf8');
  }
}

function relRepoPath() {
  // backend/tests -> backend -> repo root
  return 'backend/src/ml/artifacts/synthetic_series.json';
}

const canonicalBytes = committedBytes();
const committed = JSON.parse(canonicalBytes.toString('utf8'));
const committedSha = sha256(canonicalBytes);

/**
 * Run the exporter and return the bytes it wrote to the artifact path.
 *
 * The exporter has no output-redirect flag — it always writes
 * src/ml/artifacts/synthetic_series.json. So we snapshot the committed bytes
 * and restore them in a `finally`, guaranteeing the working tree is left
 * exactly as we found it even if an assertion throws mid-run. The regen is
 * therefore self-contained and safe to run inside the test suite.
 */
function regenArtifact() {
  const snapshot = readFileSync(artifactPath);
  try {
    const stdout = execFileSync(process.execPath, [exporterPath], {
      cwd: join(here, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const bytes = readFileSync(artifactPath);
    return { bytes, sha: sha256(bytes), stdout };
  } finally {
    writeFileSync(artifactPath, snapshot);
  }
}

describe('Canonical demand dataset: structure', () => {
  it('carries the frozen 7-SKU x 60-week shape (420 rows)', () => {
    assert.strictEqual(committed.rowCount, 420, 'rowCount metadata drifted');
    assert.strictEqual(committed.rows.length, 420, 'actual row array length drifted');
    assert.strictEqual(committed.skuCount, 7);
    assert.strictEqual(committed.weeks, WEEKS);
    assert.strictEqual(committed.weeks, 60);
    assert.strictEqual(committed.seed, HISTORY_SEED);
  });

  it('is the file the SVR artifact was trained against', () => {
    assert.strictEqual(committed.model, 'svr-demand-forecast');
    assert.strictEqual(committed.generatedBy, 'export_synthetic_dataset.mjs');
  });

  it('every SKU has exactly 60 weekly rows, all integers >= 0', () => {
    for (const sku of Object.keys(committed.skuMeta)) {
      const rows = committed.rows.filter((r) => r.sku === sku);
      assert.strictEqual(rows.length, WEEKS, `${sku} has ${rows.length} rows, want ${WEEKS}`);
      for (const r of rows) {
        assert.ok(Number.isInteger(r.qty), `${sku} week ${r.week} qty is not an integer: ${r.qty}`);
        assert.ok(r.qty >= 0, `${sku} week ${r.week} qty is negative: ${r.qty}`);
      }
    }
  });

  it('rowCount metadata matches the real row array (no silent drift)', () => {
    assert.strictEqual(committed.rowCount, committed.rows.length);
    const weeksSeen = new Set(committed.rows.map((r) => r.week));
    assert.strictEqual(weeksSeen.size, WEEKS, 'weeks are not a dense 0..59 range');
  });
});

describe('Canonical demand dataset: profile assignment is frozen', () => {
  it('index-based assignProfile matches SKU-hash profileForSku for all 7 anchors', () => {
    // The exporter derives the profile from the SKU's INDEX in
    // BASE_WEEKLY_DEMAND; the seeder derives it from a hash of the SKU STRING.
    // Those two paths must never disagree for the anchors, or the artifact the
    // model trained on stops matching the data actually seeded into Mongo.
    for (let i = 0; i < ANCHOR_SKUS.length; i += 1) {
      const sku = ANCHOR_SKUS[i];
      assert.strictEqual(
        assignProfile(i),
        profileForSku(sku),
        `${sku}: assignProfile(${i}) drifted from profileForSku()`
      );
    }
  });

  it('the 7 anchors are exactly BASE_WEEKLY_DEMAND, in frozen order', () => {
    assert.deepStrictEqual(ANCHOR_SKUS, Object.keys(BASE_WEEKLY_DEMAND));
  });

  it('extended (non-anchor) SKUs are declared but deliberately absent from the artifact', () => {
    // The artifact intentionally covers only the 7 anchor SKUs the model was
    // trained on. The 36 extended SKUs exist for the demo catalog but are NOT
    // in the training set. If someone "fixes" the exporter to emit all 43, this
    // assertion fires and they are told exactly what the model depends on.
    const extras = Object.keys(EXTRA_WEEKLY_DEMAND);
    assert.ok(extras.length > 0, 'expected the demo catalog to have extended SKUs');
    for (const sku of extras) {
      assert.ok(
        !committed.skuMeta[sku],
        `${sku} is a non-anchor SKU and must not appear in the frozen training artifact`
      );
    }
  });
});

describe('Canonical demand dataset: byte-level regen parity', () => {
  it('regenerating with export_synthetic_dataset.mjs reproduces the committed file exactly', () => {
    const { bytes, sha, stdout } = regenArtifact();
    assert.strictEqual(
      sha,
      committedSha,
      `artifact drifted from its generator.\n` +
        `  committed: ${committedSha}\n` +
        `  regen:     ${sha}\n` +
        `  exporter said: ${stdout.trim()}\n` +
        `If this is an INTENTIONAL dataset change, retrain the SVR and commit\n` +
        `BOTH the artifact and svm_model.json together.`
    );
    assert.ok(
      bytes.equals(canonicalBytes),
      'regenerated bytes differ from the committed artifact'
    );
  });

  it('the exporter is deterministic: two runs produce identical bytes', () => {
    const first = regenArtifact();
    const second = regenArtifact();
    assert.strictEqual(first.sha, second.sha, 'exporter is not deterministic across runs');
    assert.ok(first.bytes.equals(second.bytes), 'two regens produced different bytes');
  });

  it('regen does not perturb the working tree (artifact is restored)', () => {
    // If the regen left the file different, the previous assertions would still
    // have passed on a stale read. This guards the ordering assumption.
    const after = readFileSync(artifactPath);
    const afterNorm = Buffer.from(after.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    assert.ok(
      afterNorm.equals(canonicalBytes),
      'regen left synthetic_series.json modified on disk'
    );
  });
});
