function noop() { }
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function exclude_internal_props(props) {
    const result = {};
    for (const k in props)
        if (k[0] !== '$')
            result[k] = props[k];
    return result;
}
function compute_rest_props(props, keys) {
    const rest = {};
    keys = new Set(keys);
    for (const k in props)
        if (!keys.has(k) && k[0] !== '$')
            rest[k] = props[k];
    return rest;
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function set_attributes(node, attributes) {
    // @ts-ignore
    const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
    for (const key in attributes) {
        if (attributes[key] == null) {
            node.removeAttribute(key);
        }
        else if (key === 'style') {
            node.style.cssText = attributes[key];
        }
        else if (key === '__value') {
            node.value = node[key] = attributes[key];
        }
        else if (descriptors[key] && descriptors[key].set) {
            node[key] = attributes[key];
        }
        else {
            attr(node, key, attributes[key]);
        }
    }
}
function children(element) {
    return Array.from(element.childNodes);
}
function attribute_to_object(attributes) {
    const result = {};
    for (const attribute of attributes) {
        result[attribute.name] = attribute.value;
    }
    return result;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}

function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = { $$scope: 1 };
    let i = levels.length;
    while (i--) {
        const o = levels[i];
        const n = updates[i];
        if (n) {
            for (const key in o) {
                if (!(key in n))
                    to_null_out[key] = 1;
            }
            for (const key in n) {
                if (!accounted_for[key]) {
                    update[key] = n[key];
                    accounted_for[key] = 1;
                }
            }
            levels[i] = n;
        }
        else {
            for (const key in o) {
                accounted_for[key] = 1;
            }
        }
    }
    for (const key in to_null_out) {
        if (!(key in update))
            update[key] = undefined;
    }
    return update;
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : options.context || []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
let SvelteElement;
if (typeof HTMLElement === 'function') {
    SvelteElement = class extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
        }
        connectedCallback() {
            const { on_mount } = this.$$;
            this.$$.on_disconnect = on_mount.map(run).filter(is_function);
            // @ts-ignore todo: improve typings
            for (const key in this.$$.slotted) {
                // @ts-ignore todo: improve typings
                this.appendChild(this.$$.slotted[key]);
            }
        }
        attributeChangedCallback(attr, _oldValue, newValue) {
            this[attr] = newValue;
        }
        disconnectedCallback() {
            run_all(this.$$.on_disconnect);
        }
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            // TODO should this delegate to addEventListener?
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    };
}

/* src/Component.svelte generated by Svelte v3.37.0 */

function create_if_block(ctx) {
	let script0;
	let script0_src_value;
	let t;
	let script1;
	let script1_src_value;
	let mounted;
	let dispose;

	return {
		c() {
			script0 = element("script");
			t = space();
			script1 = element("script");
			if (script0.src !== (script0_src_value = "https://unpkg.com/three@0.126.1/examples/js/exporters/GLTFExporter.js")) attr(script0, "src", script0_src_value);
			if (script1.src !== (script1_src_value = "https://unpkg.com/three@0.126.1/examples/js/loaders/STLLoader.js")) attr(script1, "src", script1_src_value);
		},
		m(target, anchor) {
			insert(target, script0, anchor);
			insert(target, t, anchor);
			insert(target, script1, anchor);

			if (!mounted) {
				dispose = [
					listen(script0, "load", /*scriptLoaded*/ ctx[3]),
					listen(script1, "load", /*scriptLoaded*/ ctx[3])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(script0);
			if (detaching) detach(t);
			if (detaching) detach(script1);
			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment(ctx) {
	let script0;
	let script0_src_value;
	let t0_value = {} + ""; /* threejs is not exposed by modelviewer.dev ... */
	let t0;
	let script1;
	let script1_src_value;
	let if_block_anchor;
	let t1;
	let model_viewer;
	let mounted;
	let dispose;
	let if_block = /*loadCount*/ ctx[1] >= 2 && create_if_block(ctx);
	let model_viewer_levels = [/*options*/ ctx[0], /*$$restProps*/ ctx[4]];
	let model_viewer_data = {};

	for (let i = 0; i < model_viewer_levels.length; i += 1) {
		model_viewer_data = assign(model_viewer_data, model_viewer_levels[i]);
	}

	return {
		c() {
			script0 = element("script");
			t0 = text(t0_value);
			script1 = element("script");
			if (if_block) if_block.c();
			if_block_anchor = empty();
			t1 = space();
			model_viewer = element("model-viewer");
			this.c = noop;
			if (script0.src !== (script0_src_value = "https://unpkg.com/@google/model-viewer@1.6.0/dist/model-viewer-umd.js")) attr(script0, "src", script0_src_value);
			if (script1.src !== (script1_src_value = "https://unpkg.com/three@0.126.1/build/three.min.js")) attr(script1, "src", script1_src_value);
			set_attributes(model_viewer, model_viewer_data);
		},
		m(target, anchor) {
			append(document.head, script0);
			append(document.head, t0);
			append(document.head, script1);
			if (if_block) if_block.m(document.head, null);
			append(document.head, if_block_anchor);
			insert(target, t1, anchor);
			insert(target, model_viewer, anchor);
			/*model_viewer_binding*/ ctx[8](model_viewer);

			if (!mounted) {
				dispose = [
					listen(script0, "load", /*scriptLoaded*/ ctx[3]),
					listen(script1, "load", /*scriptLoaded*/ ctx[3])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (/*loadCount*/ ctx[1] >= 2) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			set_attributes(model_viewer, model_viewer_data = get_spread_update(model_viewer_levels, [
				dirty & /*options*/ 1 && /*options*/ ctx[0],
				dirty & /*$$restProps*/ 16 && /*$$restProps*/ ctx[4]
			]));
		},
		i: noop,
		o: noop,
		d(detaching) {
			detach(script0);
			detach(t0);
			detach(script1);
			if (if_block) if_block.d(detaching);
			detach(if_block_anchor);
			if (detaching) detach(t1);
			if (detaching) detach(model_viewer);
			/*model_viewer_binding*/ ctx[8](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

function blobFromSTL(url, resolve) {
	const loader = new THREE.STLLoader();

	const onLoad = function (geometry) {
		const material = new THREE.MeshStandardMaterial();
		const object = new THREE.Mesh(geometry, material);
		const exporter = new THREE.GLTFExporter();
		exporter.parse(object, onParse);
	};

	const onParse = function (data) {
		const str = JSON.stringify(data);
		const blob = new Blob([str], { type: "text/plain" });
		return resolve(URL.createObjectURL(blob));
	};

	loader.load(url, onLoad);
}

function instance($$self, $$props, $$invalidate) {
	const omit_props_names = ["src","options"];
	let $$restProps = compute_rest_props($$props, omit_props_names);
	let { src = "" } = $$props;

	let { options = {
		//"auto-rotate": false,
		"camera-controls": true,
		"max-field-of-view": "90deg"
	} } = $$props;

	// external scripts loaded
	let loaded = false;

	let loadCount = 0;

	function scriptLoaded() {
		$$invalidate(1, loadCount += 1);

		if (loadCount >= 4) {
			$$invalidate(6, loaded = true);
		}
	}

	// component mounted
	let mounted = false;

	onMount(function () {
		$$invalidate(7, mounted = true);
	});

	let modelViewer;

	function model_viewer_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			modelViewer = $$value;
			((($$invalidate(2, modelViewer), $$invalidate(7, mounted)), $$invalidate(6, loaded)), $$invalidate(5, src));
		});
	}

	$$self.$$set = $$new_props => {
		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
		$$invalidate(4, $$restProps = compute_rest_props($$props, omit_props_names));
		if ("src" in $$new_props) $$invalidate(5, src = $$new_props.src);
		if ("options" in $$new_props) $$invalidate(0, options = $$new_props.options);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*mounted, loaded, src*/ 224) {
			if (mounted && loaded && src) {
				blobFromSTL(src, function (res) {
					$$invalidate(2, modelViewer.src = res, modelViewer);
				});
			}
		}
	};

	return [
		options,
		loadCount,
		modelViewer,
		scriptLoaded,
		$$restProps,
		src,
		loaded,
		mounted,
		model_viewer_binding
	];
}

class Component extends SvelteElement {
	constructor(options) {
		super();
		this.shadowRoot.innerHTML = `<style>model-viewer{height:100%;width:100%}</style>`;

		init(
			this,
			{
				target: this.shadowRoot,
				props: attribute_to_object(this.attributes),
				customElement: true
			},
			instance,
			create_fragment,
			safe_not_equal,
			{ src: 5, options: 0 }
		);

		if (options) {
			if (options.target) {
				insert(options.target, this, options.anchor);
			}

			if (options.props) {
				this.$set(options.props);
				flush();
			}
		}
	}

	static get observedAttributes() {
		return ["src", "options"];
	}

	get src() {
		return this.$$.ctx[5];
	}

	set src(src) {
		this.$set({ src });
		flush();
	}

	get options() {
		return this.$$.ctx[0];
	}

	set options(options) {
		this.$set({ options });
		flush();
	}
}

customElements.define("model-viewer-pq", Component);

export default Component;
