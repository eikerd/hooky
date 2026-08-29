import fs from "fs";
import fsp from "fs/promises";
import { CONFIG_PATHS, EVENT_LOG_SEP, EVENT_LOG_MAX_BYTES } from "@/utils/constants";

export interface HookEventRecord {
  /** Monotonic id so a reconnecting client can tell what it already has. */
  id: number;
  /** Arrival time, stamped here: the runner deliberately doesn't fork `date`. */
  at: number;
  hook: string;
  tool: string;
  model: string;
  cwd: string;
}

type Listener = (event: HookEventRecord) => void;

/**
 * Tails ~/.claude/hooky-events.log and fans new lines out to SSE clients.
 *
 * The runner appends to that file with a plain `>>`; nothing coordinates the
 * two sides beyond the file itself. That's the point: hooks keep tracing
 * whether or not the app is running, and starting the app mid-session picks up
 * from wherever the file is rather than needing a daemon to have been up.
 */
class EventLogService {
  private listeners = new Set<Listener>();
  private watcher: fs.FSWatcher | null = null;
  /** Byte offset already emitted. New readers start at EOF, not at 0. */
  private offset = 0;
  private nextId = 1;
  private pending = false;
  /** Partial trailing line held back until its newline arrives. */
  private carry = "";

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    void this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  private async start(): Promise<void> {
    if (this.watcher) return;

    // Seek to the end first: on connect you want what happens next, not a
    // replay of every hook since the file was created.
    try {
      const stat = await fsp.stat(CONFIG_PATHS.eventLog);
      this.offset = stat.size;
    } catch {
      this.offset = 0;
      // Create it so fs.watch has something to watch; the runner would create
      // it on the next hook anyway.
      try {
        await fsp.writeFile(CONFIG_PATHS.eventLog, "", { flag: "a" });
      } catch {
        return; // Unwritable home: the monitor stays empty rather than throwing.
      }
    }

    try {
      this.watcher = fs.watch(CONFIG_PATHS.eventLog, () => void this.drain());
    } catch {
      this.watcher = null;
    }
  }

  private stop(): void {
    this.watcher?.close();
    this.watcher = null;
    this.carry = "";
  }

  /**
   * Read whatever arrived since `offset`.
   *
   * `pending` collapses the burst of change events fs.watch emits for a single
   * append; without it every write would be read several times over.
   */
  private async drain(): Promise<void> {
    if (this.pending) return;
    this.pending = true;

    try {
      const stat = await fsp.stat(CONFIG_PATHS.eventLog);

      // Truncated or rotated underneath us: start over rather than seeking
      // past the end and reading nothing forever.
      if (stat.size < this.offset) {
        this.offset = 0;
        this.carry = "";
      }
      if (stat.size === this.offset) return;

      const handle = await fsp.open(CONFIG_PATHS.eventLog, "r");
      try {
        const length = stat.size - this.offset;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, this.offset);
        this.offset = stat.size;

        const text = this.carry + buffer.toString("utf8");
        const lines = text.split("\n");
        // A hook may be mid-write; keep the tail until its newline lands.
        this.carry = lines.pop() ?? "";

        for (const line of lines) {
          const record = this.parse(line);
          if (record) for (const listener of this.listeners) listener(record);
        }
      } finally {
        await handle.close();
      }

      if (stat.size > EVENT_LOG_MAX_BYTES) await this.rotate();
    } catch {
      // A read failure must not kill the stream; the next append retries.
    } finally {
      this.pending = false;
    }
  }

  private parse(line: string): HookEventRecord | null {
    if (!line) return null;
    const [hook, tool, model, cwd] = line.split(EVENT_LOG_SEP);
    if (!hook) return null;
    return {
      id: this.nextId++,
      at: Date.now(),
      hook,
      tool: tool ?? "",
      model: model ?? "",
      cwd: cwd ?? "",
    };
  }

  /** Truncation is the server's job -- the runner only ever appends. */
  private async rotate(): Promise<void> {
    try {
      await fsp.writeFile(CONFIG_PATHS.eventLog, "");
      this.offset = 0;
      this.carry = "";
    } catch {
      /* leave it; a large file is better than a crashed stream */
    }
  }
}

export const eventLogService = new EventLogService();
