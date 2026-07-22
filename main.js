(function () {
    'use strict';

    console.log("[Desmos Extension] Resilient multi-mode injector initialized...");

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escapeForJSLiteral(str, quotes) {
        let escaped = str.replace(/\\/g, '\\\\');
        if (quotes === '"') {
            escaped = escaped.replace(/"/g, '\\"');
        } else if (quotes === "'") {
            escaped = escaped.replace(/'/g, "\\'");
        }
        return escaped;
    }

    function hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        return hash.toString();
    }

    function getCachedScript(hash) {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open("DcgExtensionCache", 1);
                request.onupgradeneeded = (e) => {
                    e.target.result.createObjectStore("scripts");
                };
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    const transaction = db.transaction("scripts", "readonly");
                    const store = transaction.objectStore("scripts");
                    const getReq = store.get(hash);
                    getReq.onsuccess = () => resolve(getReq.result || null);
                    getReq.onerror = () => resolve(null);
                };
                request.onerror = () => resolve(null);
            } catch(e) {
                resolve(null);
            }
        });
    }

    function setCachedScript(hash, text) {
        try {
            const request = indexedDB.open("DcgExtensionCache", 1);
            request.onsuccess = (e) => {
                const db = e.target.result;
                const transaction = db.transaction("scripts", "readwrite");
                const store = transaction.objectStore("scripts");
                store.put(text, hash);
            };
        } catch(e) {
            console.warn("[Desmos Extension] Failed to write cache:", e);
        }
    }

    function injectPatchedScript(patchedText) {
        const blob = new Blob([patchedText], { type: 'application/javascript' });
        const blobURL = URL.createObjectURL(blob);
        
        const script = document.createElement('script');
        script.src = blobURL;
        script.async = false;
        
        document.documentElement.appendChild(script);
        console.log('[Desmos Extension] Patched script injected.');
    }

    let originalScriptPromise = null;
    let resolvedCustomFunctions = null;
    let resolvedSharedJS = "";
    let resolvedSharedGLSL = "";
    let configLoaded = false;
    const pendingChunks = [];

    let resolveFunctions;
    const customFunctionsPromise = new Promise((resolve) => {
        resolveFunctions = resolve;
    });

    window.addEventListener('message', (event) => {
        if (event.source === window && event.data && event.data.type === 'DCG_FUNCTIONS_LOADED') {
            const activeFuncs = (event.data.funcs || []).filter(fn => fn.enabled !== false);
            resolvedCustomFunctions = activeFuncs;
            resolvedSharedJS = event.data.sharedJS || "";
            resolvedSharedGLSL = event.data.sharedGLSL || "";
            resolveFunctions({
                funcs: activeFuncs,
                sharedJS: resolvedSharedJS,
                sharedGLSL: resolvedSharedGLSL
            });
        }
    });

    function generateJSImplementations(funcs, sharedJS) {
        let code = (sharedJS || "") + "\n";
        code += `
        function _dcg_unwrap(val) {
            if (val === null || val === undefined) return val;
            if (typeof val === 'object' && 'n' in val && 'd' in val) {
                return val.n / val.d;
            }
            if (Array.isArray(val)) {
                return val.map(_dcg_unwrap);
            }
            return val;
        }

        function _dcg_is_rational(val) {
            if (val === null || val === undefined) return false;
            if (typeof val === 'object' && 'n' in val && 'd' in val) return true;
            if (Array.isArray(val)) return val.some(_dcg_is_rational);
            return false;
        }

        function _dcg_wrap(val, wasRational) {
            if (wasRational && typeof val === 'number') {
                if (typeof BuiltIn !== 'undefined' && BuiltIn.MR && BuiltIn.MR.liftToRationalIfInteger) {
                    return BuiltIn.MR.liftToRationalIfInteger(val);
                }
                return { n: val, d: 1, __float: val };
            }
            if (Array.isArray(val)) {
                return val.map(v => _dcg_wrap(v, wasRational));
            }
            return val;
        }
        `;
        for (let fn of funcs) {
            code += `
            function _dcg_${fn.name}(x, y, z) {
                const wasRational = _dcg_is_rational(x) || _dcg_is_rational(y) || _dcg_is_rational(z);
                x = _dcg_unwrap(x);
                y = _dcg_unwrap(y);
                z = _dcg_unwrap(z);
                try {
                    let res = (function() {
                        ${fn.jsBody}
                    })();
                    return _dcg_wrap(res, wasRational);
                } catch(e) {
                    console.error("Error in function ${fn.name}:", e);
                    return NaN;
                }
            }
            `;
        }
        return code;
    }

    function patchSourceText(patched, funcs, sharedJS, sharedGLSL) {
        if (!funcs || funcs.length === 0) return patched;
        
        if (patched.includes('_dcg_unwrap')) {
            return patched;
        }

        // Dynamic type identification derived from Desmos's own untouched built-in functions
        let type_I = "I";
        let type_L = "L";
        let type_O = "O";
        let type_me = "me";
        let type_St = "St";
        let type__r = "_r";

        // Derive type I (number) from 'hypot'
        const hypotMatch = patched.match(/hypot\s*:\s*[a-zA-Z0-9_$]+\s*\(\s*(['"\\\\]*)BuiltIn\1\s*,\s*\1hypot\1\s*,\s*\{\s*argumentTypes\s*:\s*\[\s*([a-zA-Z0-9_$]+)\s*,\s*\2\s*\]/);
        if (hypotMatch) {
            type_I = hypotMatch[2];
        }

        // Derive type L (complex) from 'complexFloor'
        const complexFloorMatch = patched.match(/complexFloor\s*:\s*[a-zA-Z0-9_$]+\s*\(\s*(['"\\\\]*)BuiltIn\1\s*,\s*\1complexFloor\1\s*,\s*\{\s*argumentTypes\s*:\s*\[\s*([a-zA-Z0-9_$]+)\s*\]/);
        if (complexFloorMatch) {
            type_L = complexFloorMatch[2];
        }

        // Derive type O (point) from 'distance'
        const distanceMatch = patched.match(/distance\s*:\s*[a-zA-Z0-9_$]+\s*\(\s*(['"\\\\]*)BuiltIn\1\s*,\s*\1distance\1\s*,\s*\{\s*argumentTypes\s*:\s*\[\s*([a-zA-Z0-9_$]+)\s*,\s*\2\s*\]/);
        if (distanceMatch) {
            type_O = distanceMatch[2];
        }

        // Derive type me (number list) from 'rowMatrix'
        const rowMatrixMatch = patched.match(/rowMatrix\s*:\s*[a-zA-Z0-9_$]+\s*\(\s*(['"\\\\]*)BuiltIn\1\s*,\s*\1rowMatrix\1\s*,\s*\{\s*argumentTypes\s*:\s*\[\s*([a-zA-Z0-9_$]+)\s*\]/);
        if (rowMatrixMatch) {
            type_me = rowMatrixMatch[2];
        }

        // Derive type St (complex list) from 'complexGCD'
        const complexGCDMatch = patched.match(/complexGCD\s*:\s*[a-zA-Z0-9_$]+\s*\(\s*(['"\\\\]*)BuiltIn\1\s*,\s*\1complexListGCD\1\s*,\s*\{\s*argumentTypes\s*:\s*\[\s*([a-zA-Z0-9_$]+)\s*\]/);
        if (complexGCDMatch) {
            type_St = complexGCDMatch[2];
        }

        // Derive type _r (point list) from 'polygon'
        const polygonMatch = patched.match(/polygon\s*:\s*[a-zA-Z0-9_$]+\s*\(\s*(['"\\\\]*)BuiltIn\1\s*,\s*\1polygon\1\s*,\s*\{\s*tag\s*:\s*['"\\\\]*reducer['"\\\\]*\s*,\s*argumentTypes\s*:\s*\[\s*([a-zA-Z0-9_$]+)\s*\]/);
        if (polygonMatch) {
            type__r = polygonMatch[2];
        }

        const typeMapping = {
            "I": type_I,
            "L": type_L,
            "O": type_O,
            "me": type_me,
            "St": type_St,
            "_r": type__r
        };

        patched = generateJSImplementations(funcs, sharedJS) + "\n" + patched;

        // 1. Patch token mapping
        const mnMatch = patched.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\{sin:\s*([a-zA-Z0-9_$]+)\s*\(\s*(['"\\\\]*)BuiltIn\3\s*,\s*\3sin\3/);
        if (mnMatch) {
            const mnVar = mnMatch[1];
            const AVar = mnMatch[2];
            const quotes = mnMatch[3];
            
            let mnInjections = "";
            for (let fn of funcs) {
                const arity = fn.arity || 1;
                const inputTypes = fn.inputTypes || Array(arity).fill("I");
                const returnType = fn.returnType || "I";
                
                const mappedInputTypes = inputTypes.map(t => typeMapping[t] || t);
                const mappedReturnType = typeMapping[returnType] || returnType;
                const argTypesStr = mappedInputTypes.join(",");
                
                // Protects all list types (me, St, _r) from being broadcast/decomposed
                const hasList = inputTypes.includes("me") || inputTypes.includes("St") || inputTypes.includes("_r");
                const listTags = hasList ? `,tag:${quotes}never-broadcast${quotes},noPeel:!0` : "";
                
                mnInjections += `${fn.name}:${AVar}(${quotes}BuiltIn${quotes},${quotes}${fn.name}${quotes},{argumentTypes:[${argTypesStr}],returnType:${mappedReturnType}${listTags}}),`;
            }
            
            const searchPattern = `var\\s+${mnVar}\\s*=\\s*\\{sin:\\s*${AVar}\\s*\\(\\s*${escapeRegExp(quotes)}BuiltIn${escapeRegExp(quotes)}\\s*,\\s*${escapeRegExp(quotes)}sin${escapeRegExp(quotes)}`;
            patched = patched.replace(
                new RegExp(searchPattern),
                `var ${mnVar}={${mnInjections}sin:${AVar}(${quotes}BuiltIn${quotes},${quotes}sin${quotes}`
            );
            console.log(`[Desmos Extension] Token mapping (${mnVar}) dynamically patched with broadcasting protection.`);
        }

        // 2. Patch evaluator mapping
        const riMatch = patched.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\{\};([a-zA-Z0-9_$]+)\s*\(\s*\1\s*,\s*\{\s*IBuiltIn:/);
        if (riMatch) {
            const riVar = riMatch[1];
            const paVar = riMatch[2];
            
            let riInjections = "";
            for (let fn of funcs) {
                riInjections += `${fn.name}:()=>_dcg_${fn.name},`;
            }
            patched = patched.replace(
                new RegExp(`var\\s+${riVar}\\s*=\\s*\\{\\s*\\};${paVar}\\s*\\(\\s*${riVar}\\s*,\\s*\\{\\s*IBuiltIn:`),
                `var ${riVar}={};${paVar}(${riVar},{${riInjections}IBuiltIn:`
            );
            console.log(`[Desmos Extension] Evaluator mapping (${riVar}) patched.`);
        }

        // 3. Patch derivative rules
        const yieMatch = patched.match(/(var|let|const)\s+([a-zA-Z0-9_$]+)\s*=\s*\{\s*exp\s*:\s*\[\s*(['"\\\\]*)q\*x_1\3\s*\]/);
        if (yieMatch) {
            const yieVar = yieMatch[2];
            const quotes = yieMatch[3];
            
            let yieInjections = "";
            for (let fn of funcs) {
                const arity = fn.arity || 1;
                const derivatives = fn.derivatives || [];
                const derivArray = [];
                for (let i = 0; i < arity; i++) {
                    const rawDeriv = derivatives[i] || "0*x_1";
                    derivArray.push(`${quotes}${escapeForJSLiteral(rawDeriv, quotes)}${quotes}`);
                }
                yieInjections += `${fn.name}:[${derivArray.join(",")}],`;
            }
            
            patched = patched.replace(
                new RegExp(`(var|let|const)\\s+${yieVar}\\s*=\\s*\\{\\s*exp\\s*:`),
                `$1 ${yieVar}={${yieInjections}exp:`
            );
            console.log(`[Desmos Extension] Derivative mapping (${yieVar}) patched.`);
        }

        // 4. Patch GLSL shader mapping
        const mneMatch = patched.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\{\s*\.\.\.[a-zA-Z0-9_$]+\s*,\s*\.\.\.[a-zA-Z0-9_$]+\s*,\s*\.\.\.[a-zA-Z0-9_$]+\s*,\s*\.\.\.[a-zA-Z0-9_$]+\s*,\s*elementsAt:\s*[a-zA-Z0-9_$]+\s*\}/);
        if (mneMatch) {
            const mneVar = mneMatch[1];
            patched = patched.replace(
                new RegExp(`var\\s+${mneVar}\\s*=\\s*\\{`),
                (match) => {
                    const isEscaped = match.includes('\\"');
                    const q = isEscaped ? '\\"' : '"';
                    
                    let sharedGLSLCompiled = sharedGLSL || "";
                    if (isEscaped) {
                        sharedGLSLCompiled = sharedGLSLCompiled.replace(/"/g, '\\"').replace(/\n/g, '\\n');
                    }
                    
                    let glslInjections = "";
                    for (let fn of funcs) {
                        if (fn.glslBody && fn.glslBody.trim() !== "") {
                            const arity = fn.arity || 1;
                            const inputTypes = fn.inputTypes || Array(arity).fill("I");
                            const returnType = fn.returnType || "I";
                            const paramNames = ["x", "y", "z"].slice(0, arity);
                            
                            const glslTypes = {
                                "I": "float",
                                "L": "vec2",
                                "O": "vec2",
                                "me": "float",
                                "St": "vec2",
                                "_r": "vec2"
                            };
                            
                            const paramsStr = paramNames.map((p, idx) => {
                                const type = inputTypes[idx] || "I";
                                const glslType = glslTypes[type] || "float";
                                return `${glslType} ${p}`;
                            }).join(", ");
                            
                            const retGlslType = glslTypes[returnType] || "float";
                            let fullGlsl = `${retGlslType} dcg_${fn.name}(${paramsStr}){\n${fn.glslBody}\n}`;
                            
                            let escapedGlsl = fullGlsl;
                            if (isEscaped) {
                                escapedGlsl = escapedGlsl.replace(/"/g, '\\"').replace(/\n/g, '\\n');
                            }
                            glslInjections += `${fn.name}:{type:${q}scalar${q},value:()=>${q}${sharedGLSLCompiled}\\n${escapedGlsl}${q}},`;
                        }
                    }
                    return `var ${mneVar}={${glslInjections}`;
                }
            );
            console.log(`[Desmos Extension] GLSL shader mapping (${mneVar}) patched.`);
        }

        let cJInjections = funcs.map(fn => `${fn.name}|${fn.name.replace(/([A-Z])/g, "-$1").toLowerCase()}`).join(" ");
        if (cJInjections) {
            patched = patched.replace(
                /(exp(?:\\)?\|exponent\s+ln(?:\\)?\|natural-log\s+log)/g,
                `$1 ${cJInjections}`
            );
        }

        patched = patched.replace(
            /(exp\s*:\s*(['"\\\\]*)mq-narration-op-exp\2\s*,)/g,
            (match, prefix, quotes) => {
                let pbeInjections = funcs.map(fn => `${fn.name}:${quotes}mq-narration-op-${fn.name.toLowerCase()}${quotes}`).join(",") + ",";
                return `${pbeInjections}${prefix}`;
            }
        );

        return patched;
    }

    function patchModule(originalModule, funcs) {
        const moduleStr = originalModule.toString();
        const argMatch = moduleStr.match(/^(?:function\s*)?\(?([^)]*)\)?\s*(?:=>)?\s*\{([\s\S]*)\}$/);
        if (!argMatch) {
            return originalModule;
        }
        
        const args = argMatch[1];
        const body = argMatch[2];
        
        const patchedBody = patchSourceText(body, funcs, resolvedSharedJS, resolvedSharedGLSL);
        
        try {
            return new Function(args, patchedBody);
        } catch (e) {
            console.error("[Desmos Extension] Failed to compile patched Webpack module:", e);
            return originalModule;
        }
    }

    // Name-independent module detection. The anchors ("sin", "BuiltIn", "IBuiltIn")
    // are intentionally identical to the string literals that mnMatch/riMatch in
    // patchSourceText() already rely on (see above) — this function just checks
    // for that same, already-validated structural core more loosely (without a
    // fixed variable name), instead of inventing a new detection approach.
    function isTargetModule(moduleStr) {
        const hasTokenMap = /\{\s*sin\s*:\s*[a-zA-Z0-9_$]+\s*\(\s*(['"\\\\]*)BuiltIn\1\s*,\s*\1sin\1/.test(moduleStr);
        const hasEvalMap = /=\s*\{\s*\};[a-zA-Z0-9_$]+\s*\(\s*[a-zA-Z0-9_$]+\s*,\s*\{\s*IBuiltIn:/.test(moduleStr);
        return hasTokenMap || hasEvalMap || moduleStr.includes('__dcg_shared_module_source__');
    }

    function isDesModderActive() {
        if (window.DesModderPreload || window.DesModder) {
            return true;
        }
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src || '';
            if (src.includes('-extension://') && (src.includes('preload') || src.includes('desmodder') || src.includes('script.js'))) {
                return true;
            }
        }
        return false;
    }

    // 1. FETCH INTERCEPTOR (zero-network cache for DesModder)
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        const url = (typeof input === 'string') ? input : (input instanceof URL ? input.href : (input && input.url));
        if (url && (
            url.includes('shared_calculator_desktop') || 
            url.includes('calculator_desktop') || 
            url.includes('calculator_geometry') || 
            url.includes('calculator_3d')
        )) {
            console.log("[Desmos Extension] Intercepted fetch request from DesModder:", url);
            try {
                const config = await customFunctionsPromise;
                const hash = "fetch_" + hashCode(url + JSON.stringify(config.funcs) + config.sharedJS + config.sharedGLSL);
                
                let patchedText = await getCachedScript(hash);
                if (patchedText) {
                    console.log("[Desmos Extension] Zero-network cache hit! Skipping download and patching.");
                    return new Response(patchedText, {
                        status: 200,
                        statusText: "OK",
                        headers: { "Content-Type": "application/javascript" }
                    });
                }
                
                console.log("[Desmos Extension] Cache miss. Downloading original file once...");
                const response = await originalFetch(input, init);
                const text = await response.text();
                
                console.log("[Desmos Extension] Patching Desmos code...");
                patchedText = patchSourceText(text, config.funcs, config.sharedJS, config.sharedGLSL);
                setCachedScript(hash, patchedText);
                
                return new Response(patchedText, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            } catch(err) {
                console.error("[Desmos Extension] Error in interceptor:", err);
                throw err;
            }
        }
        return originalFetch(input, init);
    };

    // 2. STANDALONE INTERCEPTOR (zero-network cache, used when DesModder is inactive)
    const observer = new MutationObserver((mutations) => {
        if (isDesModderActive()) {
            return;
        }
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.tagName === 'SCRIPT' && node.src && (
                    node.src.includes('shared_calculator_desktop') ||
                    node.src.includes('calculator_desktop') ||
                    node.src.includes('calculator_geometry') ||
                    node.src.includes('calculator_3d')
                )) {
                    const originalSrc = node.src;
                    
                    node.removeAttribute('src');
                    node.type = 'javascript/blocked';
                    node.remove();

                    console.log('[Desmos Extension] Standalone script intercepted:', originalSrc);
                    
                    customFunctionsPromise.then(async (config) => {
                        const hash = "standalone_" + hashCode(originalSrc + JSON.stringify(config.funcs) + config.sharedJS + config.sharedGLSL);
                        
                        let patchedText = await getCachedScript(hash);
                        if (patchedText) {
                            console.log("[Desmos Extension] Zero-network cache hit! Skipping download.");
                            injectPatchedScript(patchedText);
                            return;
                        }
                        
                        console.log("[Desmos Extension] Cache miss. Downloading...");
                        fetch(originalSrc)
                            .then(response => response.text())
                            .then(text => {
                                console.log(`[Desmos Extension] Patching core...`);
                                patchedText = patchSourceText(text, config.funcs, config.sharedJS, config.sharedGLSL);
                                setCachedScript(hash, patchedText);
                                injectPatchedScript(patchedText);
                            })
                            .catch(err => {
                                console.warn('[Desmos Extension] Standalone download failed:', err.message);
                            });
                    });
                }
            }
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // 3. WEBPACK-HOOKS
    const hookedGlobals = new Set();
    function applyHook(arrayName) {
        if (hookedGlobals.has(arrayName)) return;
        hookedGlobals.add(arrayName);

        let currentValue = window[arrayName];
        const setupQueue = (arr) => {
            if (!arr || arr.hasDcgHook) return;
            arr.hasDcgHook = true;

            const originalPush = arr.push;
            arr.push = function (chunk) {
                if (!configLoaded) {
                    console.log(`[Desmos Extension] Webpack chunk pushed before config loaded. Queuing...`);
                    pendingChunks.push({ arrayName, chunk, originalPush, context: this });
                    return;
                }

                try {
                    const modules = chunk[1];
                    if (modules && resolvedCustomFunctions) {
                        for (let id in modules) {
                            const moduleStr = modules[id].toString();
                            if (isTargetModule(moduleStr)) {
                                
                                console.log(`[Desmos Extension] Webpack channel (${arrayName}): Module ${id} intercepted.`);
                                modules[id] = patchModule(modules[id], resolvedCustomFunctions);
                            }
                        }
                    }
                } catch(e) {
                    console.error(`[Desmos Extension] Error in Webpack hook for ${arrayName}:`, e);
                }
                return originalPush.apply(this, arguments);
            };
        };

        if (currentValue) setupQueue(currentValue);

        Object.defineProperty(window, arrayName, {
            configurable: true,
            enumerable: true,
            get() { return currentValue; },
            set(newValue) {
                setupQueue(newValue);
                currentValue = newValue;
            }
        });
    }

    const targetWebpackGlobals = ['webpackChunkdesmos_calculator', 'webpackChunkdesmos_geometry', 'webpackChunkdesmos_3d', 'webpackChunk'];
    targetWebpackGlobals.forEach(name => applyHook(name));

    customFunctionsPromise.then((config) => {
        configLoaded = true;
        console.log(`[Desmos Extension] Config loaded. Processing ${pendingChunks.length} queued chunks...`);
        
        while (pendingChunks.length > 0) {
            const item = pendingChunks.shift();
            const { chunk, originalPush, context } = item;
            
            try {
                const modules = chunk[1];
                if (modules && config.funcs) {
                    for (let id in modules) {
                        const moduleStr = modules[id].toString();
                        if (isTargetModule(moduleStr)) {
                            
                            console.log(`[Desmos Extension] Webpack channel (${item.arrayName}): Delayed Module ${id} intercepted.`);
                            modules[id] = patchModule(modules[id], config.funcs);
                        }
                    }
                }
            } catch(e) {
                console.error(`[Desmos Extension] Error in processing delayed chunk:`, e);
            }
            
            originalPush.apply(context, [chunk]);
        }
    });

    // 4. WEB-WORKER OVERRIDE
    const originalBlob = window.Blob;
    window.Blob = function (parts, options) {
        if (options && options.type && options.type.includes('javascript')) {
            for (let i = 0; i < parts.length; i++) {
                if (typeof parts[i] === 'string' && (parts[i].includes('__dcg_worker_module__') || isTargetModule(parts[i]))) {
                    console.log('[Desmos Extension] Web worker blob creation patched.');
                    if (resolvedCustomFunctions) {
                        parts[i] = patchSourceText(parts[i], resolvedCustomFunctions, resolvedSharedJS, resolvedSharedGLSL);
                    } else {
                        console.warn('[Desmos Extension] customFunctions not loaded yet!');
                    }
                }
            }
        }
        return new originalBlob(parts, options);
    };
    window.Blob.prototype = originalBlob.prototype;

})();
