import { createHmac } from "crypto";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Monito SDK
 *
 */
export class MonitoAPI {
    //  Private fields 
    #apiKey;
    #apiSecret;
    #ingestUrl;
    #environment;
    #excludePaths;
    #batchSize;
    #debug;

    #buffer = [];
    #flushTimer = null;
    #isFlushing = false;

    /**
     * @param {Object}   options
     * @param {string}   options.apiKey
     * @param {string}   options.apiSecret
     * @param {string}   options.serverUrl
     * @param {string}   options.environment   e.g. "production" | "staging" | "development"
     * @param {string[]} [options.excludePaths=[]]
     * @param {number}   [options.batchSize=10]
     * @param {number}   [options.flushInterval=5000]
     * @param {boolean}  [options.debug=false]
     */
    constructor(options = {}) {
        const {
            apiKey,
            apiSecret,
            serverUrl,
            environment,
            excludePaths = [],
            batchSize = 10,
            flushInterval = 5000,
            debug = false,
        } = options;

        if (!apiKey) throw new Error("[monito] apiKey is required");
        if (!apiSecret) throw new Error("[monito] apiSecret is required");
        if (!serverUrl) throw new Error("[monito] serverUrl is required");
        if (!environment) throw new Error("[monito] environment is required");

        this.#apiKey = apiKey;
        this.#apiSecret = apiSecret;
        this.#ingestUrl = `${serverUrl.replace(/\/$/, "")}/api/v1/ingest`;
        this.#environment = environment;
        this.#excludePaths = excludePaths;
        this.#batchSize = batchSize;
        this.#debug = debug;

        this.#startFlushTimer(flushInterval);
        this.#registerExitFlush();
    }

    //  Private: logging 

    #log(...args) {
        if (this.#debug) console.log("[monito]", ...args);
    }

    //  Private: flush timer 

    #startFlushTimer(interval) {
        if (this.#flushTimer) clearInterval(this.#flushTimer);
        this.#flushTimer = setInterval(
            () => this.flush().catch((err) => this.#log("Flush error:", err.message)),
            interval,
        );
        if (this.#flushTimer.unref) this.#flushTimer.unref();
    }

    //  Private: exit hook (once per process) 

    #registerExitFlush() {
        if (process._monitoExitRegistered) return;
        process._monitoExitRegistered = true;
        process.on("beforeExit", () => this.flush().catch(() => { }));
    }

    //  Private: HMAC sign 

    #sign(bodyStr, timestamp) {
        return createHmac("sha256", this.#apiSecret)
            .update(bodyStr + timestamp)
            .digest("hex");
    }

    //  Private: send one event with retry 

    async #send(event) {
        const MAX_RETRIES = 3;
        const bodyStr = JSON.stringify(event);

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const timestamp = Date.now().toString();
                const res = await fetch(this.#ingestUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": this.#apiKey,
                        "x-signature": this.#sign(bodyStr, timestamp),
                        "x-timestamp": timestamp,
                    },
                    body: bodyStr,
                });

                if (res.ok || res.status === 202) return true;

                // Rate limited - honour Retry-After header
                if (res.status === 429) {
                    const wait = parseInt(res.headers.get("Retry-After") ?? "2", 10);
                    this.#log(`Rate limited - retrying in ${wait}s (attempt ${attempt}/${MAX_RETRIES})`);
                    await sleep(wait * 1000);
                    continue;
                }

                // 4xx (not 429) - bad event, no point retrying
                if (res.status >= 400 && res.status < 500) {
                    this.#log(`Client error ${res.status} - dropping event`);
                    return false;
                }

                // 5xx - transient server error, back off and retry
                this.#log(`Server error ${res.status} (attempt ${attempt}/${MAX_RETRIES})`);
                if (attempt < MAX_RETRIES) await sleep(300 * 2 ** (attempt - 1));

            } catch (err) {
                this.#log(`Network error (attempt ${attempt}/${MAX_RETRIES}): ${err.message}`);
                if (attempt < MAX_RETRIES) await sleep(300 * 2 ** (attempt - 1));
            }
        }

        return false;
    }

    //  Public: flush 

    /**
     * Drains the event buffer and sends all pending events to the ingest server.
     * Safe to call manually at any time.
     *
     * @returns {Promise<void>}
     */
    async flush() {
        if (this.#buffer.length === 0 || this.#isFlushing) return;

        this.#isFlushing = true;
        const events = this.#buffer.splice(0, this.#buffer.length);
        this.#log(`Flushing ${events.length} event(s)`);

        for (const event of events) {
            const sent = await this.#send(event);
            if (!sent) this.#log(`Dropped event: ${event.method} ${event.endpoint}`);
        }

        this.#isFlushing = false;
    }

    //  Public: init() 

    /**
     * Returns the Express capture middleware.
     * Mount this once at your app root - before any routers.
     *
     * @returns {Function} Express middleware
     */
    init() {
        return (req, res, next) => {
            const startTime = Date.now();
            const rawPath = req.originalUrl.split("?")[0];

            if (this.#excludePaths.some((p) => rawPath.startsWith(p))) {
                return next();
            }

            res.on("finish", () => {
                // Only capture requests that passed through service()
                if (!req.__monitoLabel) return;

                const statusCode = res.statusCode;
                const endpoint = req.route?.path
                    ? req.baseUrl + req.route.path
                    : rawPath;

                const event = {
                    service: req.__monitoLabel,
                    environment: this.#environment,
                    endpoint,
                    method: req.method,
                    status: statusCode,
                    latency: Date.now() - startTime,
                    error: statusCode >= 400
                        ? (res.locals.__monitoError ?? `HTTP ${statusCode}`)
                        : null,
                };

                this.#buffer.push(event);
                this.#log(`[${event.service}] ${event.method} ${event.endpoint} → ${statusCode} (${event.latency}ms)`);

                if (this.#buffer.length >= this.#batchSize) {
                    this.flush().catch((err) => this.#log("Flush error:", err.message));
                }
            });

            next();
        };
    }

    //  Public: service() 

    /**
     * Stamps a service name on the request.
     * Place this before any router or handler you want tracked.
     *
     * @param {string} name  Service name shown in the dashboard.
     * @returns {Function}   Express middleware.
     */
    service(name) {
        if (!name || typeof name !== "string") {
            throw new Error("[monito] service() requires a non-empty string");
        }
        return (req, _res, next) => {
            req.__monitoLabel = name;
            next();
        };
    }

    //  Public: destroy() 

    /**
     * Stops the flush timer and drains any remaining buffered events.
     * Call this during graceful server shutdown or in tests between runs.
     *
     * @returns {Promise<void>}
     */
    async destroy() {
        clearInterval(this.#flushTimer);
        this.#flushTimer = null;
        await this.flush();
        this.#log("Destroyed - timer stopped, buffer drained");
    }
}