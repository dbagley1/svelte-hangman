
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
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
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
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
    function children(element) {
        return Array.from(element.childNodes);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { stylesheet } = info;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                info.rules = {};
            });
            managed_styles.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
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
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
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
        seen_callbacks.clear();
        set_current_component(saved_component);
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

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
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
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
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
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
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
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
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
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.48.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const answerCategories = {
      "Colors": {
        "title": "Colors",
        "emoji": "🎨",
        "words": [
          "fuchsia~Fancy name for a shade of pink.",
          "salmon~Also the name of a fish.",
          "firebrick~Brick used in furnaces.",
          "coral~Great Barrier Reef is famous for this.",
          "moccasin~Type of footwear.",
          "lavender~Flower used for aromatherapy.",
          "olive~Mediterranean fruit.",
          "teal~Freshwater wild ducks.",
          "peachpuff~Named after Peach.",
          "cornsilk~Has corn in it's name.",
          "turquoise~Bluish green phosphate mineral.",
          "sienna~Yellowish brown Earth pigment.",
          "cadetblue~Shade of cyan.",
          "chocolate~Made from cocoa.",
          "seashell~Found washed up on beaches.",
          "honeydew~Named after a fruit of the melon family.",
          "ivory~Elephant's tusk.",
          "papayawhip~Named after papaya.",
          "thistle~National flower of Scotland.",
          "amber~Glistening gem.",
          "rosybrown~Light shade of red with brown in it's name.",
          "beige~Color of natural wool.",
          "burlywood~Derives it's name from wood.",
          "gold~Precious metal.",
          "cyan~Member of CMYK quartet.",
          "plum~Popular form of cake.",
          "snow~Ice crystals.",
          "wheat~Most widely used grain.",
          "tomato~La Tomatina festival."
        ],
      },

      "Shapes": {
        "title": "Shapes",
        "emoji": "📐",
        "words": [
          "rhombus~Diamond shape.",
          "cube~Rubik's ?",
          "pentagon~Symbol of US military.",
          "cone~Ice cream holders.",
          "trapezoid~Trapezium in English outside North America.",
          "oval~Cricket ground in London.",
          "ellipse~Squashed circle.",
          "square~Four equal sides.",
          "triangle~Equilateral, isosceles and scalene.",
          "parallelogram~Special type of quadrilateral.",
          "cylinder~Flat circular ends and long straight sides.",
          "hexagon~Benzene rings are of this shape.",
          "rectangle~Quadrilateral with four right angles.",
          "circle~Has a radius and a diameter.",
          "triangular prism~Three sided prism.",
          "octahedron~Polyhedron with eight faces.",
          "heptagon~Also known as Septagon.",
          "octagon~Eight sided polygon.",
          "quadrilateral~Base of square and rectangle.",
          "trapezium~Alternative name of trapezoid.",
          "polygon~Base of hexagon, heptagon and octagon.",
          "sphere~Shape of the Earth.",
          "cuboid~Convex polyhedron with six faces.",
          "pyramid~Found in Egypt.",
          "ellipsoid~Obtained from sphere by deforming it.",
          "nonagon~Nine sided polygon.",
          "tetrahedron~Pyramid shape with four sides.",
          "kite~Flying object.",
          "decagon~Ten sided polygon."
        ],
      },

      "Movies": {
        "title": "Movies",
        "emoji": "🎬",
        "words": [
          "the vow~Wedding promise.",
          "princess diaries~Princess of Genovia.",
          "jumanji~World's most dangerous video game.",
          "the notebook~Allie and Noah.",
          "freaky friday~Mother and daughter switching souls.",
          "frozen~True love can thaw a ? heart.",
          "brave~Scottish tale of an archer princess.",
          "tangled~Girl with the 70 foot long golden locks.",
          "notting hill~British bookseller meets American actress.",
          "love actually~Christmas themed romantic comedy.",
          "amelie~Young French waitress caught in an imaginative world.",
          "pretty woman~Romantic comedy with Julia Roberts as lead.",
          "titanic~The ship that could not sink.",
          "the proposal~Andrew and Margaret's trip to Sitka.",
          "the terminal~Victor Navorski stranded at the airport.",
          "sully~Miracle on the Hudson.",
          "home alone~Eight year old Kevin saving his house from burglars.",
          "blended~Blended familymoon.",
          "despicable me~Gru and his Minions.",
          "inception~Your mind is the scene of the crime.",
          "ratatouille~Little Chef.",
          "ghostbusters~Catching ghosts in New York.",
          "up~On an adventure in a flying house.",
          "finding neverland~Story of a man who doesn't want to grow up.",
          "fantastic four~Astronauts gaining superpowers after being hit by cosmic radiation.",
          "coco~Miguel's adventures in the Land of the Dead.",
          "onward~Ian and Barley embark on a magical quest.",
          "interstellar~A team of explorers travel through a wormhole in space to ensure humanity's survival.",
          "gravity~Two astronauts marooned in space struggle for survival."
        ],
      },

      "Superheroes": {
        "title": "Superheroes",
        "emoji": "🦸",
        "words": [
          "thor~God of Thunder.",
          "wonder woman~Amazonian warrior queen.",
          "superman~Man of Steel.",
          "rogue~A mutant, she absorbs the power of anyone she touches.",
          "black panther~Wakandan king.",
          "storm~Possesses psionic abilities to manipulate the weather.",
          "hawkeye~Master marksman and a former special agent of S.H.I.E.L.D.",
          "captain america~God's righteous man who leads the Avengers.",
          "ironman~Genius. Billionaire. Playboy. Philanthropist.",
          "black widow~Super spy who has become one of S.H.I.E.L.D.'s most deadly assassins.",
          "starlord~Leader of the Guardians of the Galaxy",
          "scarlet witch~Powerful mutant sorceress, has been a part of both Avengers and X-Men.",
          "green lantern~Part of an alien interstellar police force who fights evil with the aid of his ring.",
          "batman~The Dark Knight.",
          "spiderman~The friendly neighbourhood superhero.",
          "antman~Master thief and now a superhero who can shrink and expand with the help of his futuristic suit.",
          "cyclops~The first of the X-Men who can unleash an uncontrollable blast of optic force.",
          "flash~The fastest man alive who fights against evil with his super speed.",
          "quicksilver~With the ability to run at the speed of sound, he is always racing to uncover his past and the road to the future.",
          "captain marvel~Former pilot, who upon being exposed to energy of the Tesseract, obtained cosmic powers.",
          "wolverine~A mutant with healing power, adamantium metal claws and a no-nonsense attitude.",
          "aquaman~King of the Seven Seas.",
          "human torch~An astronaut, who gained his powers on a spacecraft bombarded by cosmic rays.",
          "invisible woman~Uses her power of invisibility and mental ability to manipulate ambient cosmic energy to save Earth.",
          "hulk~Bruce Banner's alter ego, who is always angry.",
          "falcon~A former US Air Force pararescue airman, he teams up with Cap to foil HYDRA's plans.",
          "the thing~Orange colored, thick skinned, heavily muscled, and superhumanly strong thing.",
          "hawkgirl~An immortal warrior and part of the Justice League.",
          "deadpool~Merc with a Mouth."
        ],
      },

      "Countries": {
        "title": "Countries",
        "emoji": "🏳️",
        "words": [
          "spain~La Tomatina festival.",
          "india~Home of the Taj Mahal.",
          "morocco~Mountainous country of western North Africa that lies directly across the Strait of Gibraltar from Spain.",
          "france~Cannes film festival is hosted here.",
          "netherlands~The Oranje country.",
          "russia~Largest country in the world.",
          "ireland~The Emerald Isle of Europe.",
          "germany~Oktoberfest destination.",
          "italy~Home of pizza and pasta.",
          "austria~Lies in East Central Europe and is surrounded by 8 different countries.",
          "czech republic~Has the highest castle density in the world.",
          "ghana~The Garden City of West Africa is situated here.",
          "maldives~Island nation in the Indian ocean, known for its natural environment including the blue ocean, white beaches and clean air.",
          "croatia~The great Nikola Tesla was born here.",
          "malaysia~Home to the Petronas Towers.",
          "fiji~Soft Coral Capital of the World.",
          "denmark~Home to LEGO and handball and birthplace of Hans Christian Andersen.",
          "jamaica~Caribbean nation known for its sports achievements.",
          "norway~Land of the midnight sun.",
          "canada~Has a maple leaf on its flag.",
          "sweden~Home to IKEA, Volvo and H&M.",
          "mexico~Famous for its Mayan temples and its cuisine.",
          "chile~Home to the Atacama desert.",
          "brazil~The national football team of this country has won the FIFA World Cup a record five times.",
          "iceland~Land of the volcanoes and hot springs.",
          "new zealand~All Blacks and All Whites.",
          "argentina~FC Barcelona's GOAT resides here.",
          "japan~Land of the Rising Sun.",
          "portugal~Part of the Iberian peninsula."
        ],
      },

      "Flowers": {
        "title": "Flowers",
        "emoji": "🌼",
        "words": [
          "orchid~Bright rich purple colored flowers.",
          "lily~Also the name of Harry's mother.",
          "rose~Proposal flowers, mostly.",
          "lotus~Sacred and national flower of India.",
          "jasmine~An important scent noted in perfumes, and also has herbal properties.",
          "daffodil~Along with tulips, this yellow colored flower is one of the most popular springtime bulbs.",
          "daisy~Girlfriend of Donald Duck.",
          "hibiscus~Native to warm temperate, subtropical and tropical regions throughout the world.",
          "gerbera~Also commonly known as the African daisy.",
          "sunflower~Bright yellow colored flowers named after the Sun.",
          "tulip~Large, showy and brightly colored, they are the most colorful of all spring flowers.",
          "peony~Large, showy and often fragrant, occuring in a glorious spectrum of colors including purple, red, white and yellow.",
          "dahlia~Declared the national flower of Mexico.",
          "marigold~Also called the herb of the sun.",
          "petunia~Harry's maternal aunt.",
          "lavender~Fragrance from the oils of this plant is believed to help promote calmness and wellness.",
          "periwinkle~A unique plant, which blends ornamental values and medicinal properties.",
          "cherry blossom~Found in abundance in Japan.",
          "bluebell~These blue colored sweet-smelling flowers nod or droop to one side of the flowering stem and have creamy white-coloured pollen inside.",
          "dandelion~Bright yellow flowers whose oil is often used in recipes designed to soothe and heal chapped or cracked skin.",
          "chrysanthemum~One of the most popular fall garden flowers.",
          "hyacinth~Highly fragrant, bell-shaped flowers with reflexed petals.",
          "snowdrop~White drooping bell shaped flower with six petal-like tepals in two circles.",
          "iris~Named for the Greek goddess of the rainbow.",
          "geranium~Bright flowers that grow in the eastern part of the Mediterranean region.",
          "honeysuckle~Derives its name from the edible sweet nectar obtainable from its tubular flowers.",
          "hazel~There's a nut named after this.",
          "mistletoe~Widely used as a Christmas tradition.",
          "nightshade~Grow in shade and flower at night."
        ],
      },

      "Disney": {
        "title": "Disney",
        "emoji": "🏰",
        "words": [
          "eugene~Also known for his smouldering intensity.",
          "rapunzel~The long lost princess caged in a tower.",
          "nemo~The little clownfish who gets abducted from the Great Barrier Reef.",
          "aladdin~A wily but kind thief in the city of Agrabah.",
          "jasmine~Sultan's daughter and fiesty princess of Agrabah.",
          "ariel~Youngest daughter of King Triton and Queen Athena of an underwater kingdom, Atlantica.",
          "elsa~The Snow Queen, heir to the throne of Arendelle.",
          "dory~The forgetful blue tang fish who helped Marlin in finding Nemo.",
          "simba~Son of Mufasa and Sarabi, who grows up to become King of the Pride Lands.",
          "aurora~She who fell into a deep slumber only to be awakened later.",
          "olaf~The little snowman who is known for his warm hugs.",
          "anna~Princess of Arendelle and Elsa's sister.",
          "belle~A proud bibliophile, she becomes prisoner to the Beast to save her father's life.",
          "astrid~Free spirited and playful, she is a Viking warrior of Clan Hofferson of the Hooligan tribe.",
          "hiccup~Current chief of the Hooligan tribe of the Viking kingdom of Berk.",
          "merida~Archer princess of the Scottish kingdom of DunBroch.",
          "dumbo~A baby elephant who can fly with the help of his oversized ears.",
          "linguini~Son of Gusteau, who befriends Remy.",
          "maui~The boisterous demigod often found with his giant, magical fish hook.",
          "toothless~Hiccup Horrendous Haddock III's Night Fury.",
          "eva~A robot probe easily identifiable by her characteristic glossy white egg-shaped body and blue LED eyes.",
          "mowgli~The man-cub from Sionese who united the jungle.",
          "woody~The Sheriff who alongside Buzz forms a formidable partnership.",
          "alice~Follows a rabbit in a blue coat to a magical wonderland from her dreams.",
          "moana~Embarks on a journey to return the heart of goddess Te Fiti from Maui.",
          "kristoff~Ice harvester, often found with Sven.",
          "mater~The lovable, rustiest and trustiest tow truck in Radiator Springs.",
          "buzz lightyear~Toy Space Ranger superhero and Woody's best friend.",
          "miguel~The 12 year old boy who is accidentally transported to the Land of the Dead."
        ],
      },

      "HarryPotter": {
        "title": "Harry Potter",
        "emoji": "🧙",
        "words": [
          "leaky cauldron~Popular wizarding pub and inn located in London.",
          "quidditch~Played by witches and wizards riding flying broomsticks.",
          "marauders map~Magical document that revealed all of Hogwarts School of Witchcraft and Wizardry.",
          "harry potter~The boy who lived.",
          "transfiguration~Taught by Minerva McGonagall.",
          "boggart~A shapeshifter that took the form of the victim's worst fear.",
          "remembrall~Neville received this as a gift from his grandmother.",
          "hermione granger~The brightest witch of her age.",
          "herbology~Study of magical and mundane plants.",
          "muggle~Non magic person.",
          "galleon~Most valuable of the wizarding currency.",
          "alohomora~A charm that unlocks objects such as doors and windows.",
          "animagus~A witch or wizard who can transform at will into an animal.",
          "ron weasley~The guy who is always there when Harry needs him.",
          "riddikulus~A charm used in defence against a Boggart.",
          "yule ball~Formal Christmas celebration, which was held for students of Wizarding schools who participated in the Triwizard Tournament.",
          "apparition~A magical form of teleportation, through which a witch or wizard can disappear from one location and reappear in another.",
          "albus dumbledore~Headmaster at Hogwarts.",
          "the burrow~Family home of the Weasleys.",
          "diagon alley~Cobblestoned wizarding alley and shopping area located behind Leaky Cauldron.",
          "severus snape~The Half-Blood Prince.",
          "divination~A form of magic which attempts to foresee future events.",
          "expecto patronum~A spell used to ward off Dementors.",
          "floo network~Mode of wizarding transportation by means of a particular powder and a fireplace.",
          "gillyweed~A magical plant that, when eaten, allows a human to breathe underwater.",
          "gryffindor~Hogwarts house which roughly corresponds to the element of fire.",
          "ravenclaw~This Hogwarts house prizes learning, wisdom, wit, and intellect in its members.",
          "incendio~A charm that conjured a jet of flames that could be used to set things alight.",
          "pensieve~A magical repository for memories."
        ],
      },

      "Music": {
        "title": "Music",
        "emoji": "🎵",
        "words": [
          "acoustic~Music that primarily uses instruments that produce sound without electric or electonic means.",
          "ballad~A song that tells a story, and it can be dramtic, funny or romantic.",
          "chord~Two or more harmonic notes played simultaneously.",
          "chorus~A repeated section that contains the primary musical and lyrical motifs of the song.",
          "edm~Electronic dance music.",
          "grunge~Hybrid of punk and metal.",
          "heavy metal~Loud, aggressive style of rock music.",
          "jazz~A form of music whose chief characteristic was improvisation.",
          "mixtape~A compilation of music, typically from multiple sources, recorded onto a medium.",
          "punk rock~Often described as harder, louder, and cruder than other rock music.",
          "reggae~Music genre that originated in Jamaica and epitomised by Bob Marley.",
          "remix~A subset of audio mixing in music and song recordings.",
          "rhythm~The pattern of sound, silence, and emphasis in a song.",
          "tambourine~A musical instrument in the percussion family consisting of a wooden or plastic frame with pairs of small metal jingles, called zills.",
          "turntable~A circular rotating platform of a phonograph, for playing sound recordings.",
          "verse~A repeated section of a song that typically features a new set of lyrics on each repetition.",
          "yodel~A form of singing which involves repeated and rapid changes of pitch between the low-pitch chest register and the high-pitch head register or falsetto.",
          "saxophone~A family of single-reed wind instruments ranging from soprano to bass and characterized by a conical metal tube and finger keys.",
          "cello~A bowed string instrument of the violin family.",
          "synthesizer~An electronic musical instrument that generates audio signals.",
          "composition~An original piece or work of music, either vocal or instrumental, the structure of a musical piece, or to the process of creating or writing a new piece of music.",
          "pitch~The quality that makes it possible to judge sounds as higher and lower.",
          "opera~A theatrical work consisting of a dramatic text, that has been set to music and staged with scenery, costumes, and movement.",
          "concert~A live music performance in front of an audience.",
          "symphony~A lengthy form of musical composition for orchestra, normally consisting of several large sections.",
          "harmonica~Also known as a French harp or mouth organ, is a free reed wind instrument used worldwide in many musical genres.",
          "trumpet~A brass instrument commonly used in classical and jazz ensembles.",
          "violin~The smallest and highest pitched string instrument typically used in western music.",
          "tempo~Defined as the pace or speed at which a section of music is played."
        ],
      },

      "Fantasy": {
        "title": "Fantasy",
        "emoji": "🦄",
        "words": [
          "unicorn~Mythological animal resembling a horse with a single horn on its forehead.",
          "lochness~In Scottish folklore, often described as large, long-necked, and with one or more humps protruding from the water.",
          "apprentice~A person who works for another in order to learn a trade.",
          "alchemy~Defined as the process of taking something ordinary and turning it into something extraordinary, sometimes in a way that cannot be explained.",
          "chalice~A footed cup intended to hold a drink during a ceremony.",
          "conjure~To make something appear by magic.",
          "gnome~An ageless and often deformed dwarf of folklore who lives in the earth and usually guards treasure.",
          "pixie~Mythical creature of British folklore portrayed as small and humanlike in form, with pointed ears and a pointed hat.",
          "soothsayer~A person who predicts the future by magical, intuitive, or more rational means.",
          "dungeon~A dark underground prison in a castle.",
          "leprechaun~In Irish folklore, usually depicted as little bearded men, wearing a coat and hat, who partake in mischief.",
          "bewitch~Control someone's behaviour with magic.",
          "realm~An area of interest or activity.",
          "satyr~A god in Greek literature who is half man and half goat.",
          "golem~A figure artificially constructed in the form of a human being and endowed with life.",
          "griffin~A mythical creature with the head and wings of an eagle and the body of a lion.",
          "nymph~A nature spirit in the guise of an attractive maiden.",
          "dragon~A mythical monster generally represented as a huge, winged reptile with crested head and enormous claws and teeth, and often spouting fire.",
          "crystal ball~A sphere especially of quartz crystal traditionally used by fortune-tellers.",
          "enchantment~The state of being under a spell.",
          "hobbit~An imaginary race of half-size people living in holes.",
          "divination~The art or practice that seeks to foresee or foretell future events.",
          "portal~Large and imposing gateway or entry to something else.",
          "phoenix~A mythological bird that cyclically regenerates or is otherwise born again.",
          "hippogriff~A legendary animal having the foreparts of a griffin and the body of a horse.",
          "yeti~Also known as the Abominable Snowman.",
          "werewolf~A human with the ability to shapeshift into a wolf.",
          "centaur~A race of creatures fabled to be half human and half horse.",
          "pegasus~A mythical winged divine horse."
        ],
      },
    };

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }
    function slide(node, { delay = 0, duration = 400, easing = cubicOut } = {}) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => 'overflow: hidden;' +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }

    const getAnswerFromCategory = (category) => {
      const categoryArray = answerCategories[category]["words"];
      const randomIndex = Math.floor(Math.random() * categoryArray.length);
      return categoryArray[randomIndex].split("~");
    };

    const getRandomCategory = () => {
      const categoryArray = Object.keys(answerCategories);
      const randomIndex = Math.floor(Math.random() * categoryArray.length);
      return categoryArray[randomIndex];
    };

    /* src/App.svelte generated by Svelte v3.48.0 */

    const { Object: Object_1, window: window_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[22] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[28] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	return child_ctx;
    }

    function get_each_context_4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[33] = list[i];
    	child_ctx[35] = i;
    	return child_ctx;
    }

    // (69:4) {#if gameOver}
    function create_if_block_2(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let button;
    	let div_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*gameLost*/ ctx[2] && create_if_block_4(ctx);
    	let if_block1 = /*gameWon*/ ctx[1] && create_if_block_3(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			button = element("button");
    			button.textContent = "Play Again";
    			add_location(button, file, 76, 8, 2130);
    			attr_dev(div, "class", "gameOver");
    			add_location(div, file, 69, 6, 1886);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t0);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t1);
    			append_dev(div, button);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[18], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*gameLost*/ ctx[2]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(div, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*gameWon*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(div, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fly, {}, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fly, {}, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching && div_transition) div_transition.end();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(69:4) {#if gameOver}",
    		ctx
    	});

    	return block;
    }

    // (71:8) {#if gameLost}
    function create_if_block_4(ctx) {
    	let h2;
    	let t0;
    	let t1_value = /*answer*/ ctx[5].toUpperCase() + "";
    	let t1;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t0 = text("Game Over. The answer was: ");
    			t1 = text(t1_value);
    			add_location(h2, file, 71, 10, 1957);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t0);
    			append_dev(h2, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*answer*/ 32 && t1_value !== (t1_value = /*answer*/ ctx[5].toUpperCase() + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(71:8) {#if gameLost}",
    		ctx
    	});

    	return block;
    }

    // (74:8) {#if gameWon}
    function create_if_block_3(ctx) {
    	let h1;
    	let t0;
    	let t1_value = /*guesses*/ ctx[0].length + "";
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text("You won in ");
    			t1 = text(t1_value);
    			t2 = text(" guesses!");
    			attr_dev(h1, "class", "svelte-1w4ku53");
    			add_location(h1, file, 74, 10, 2062);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*guesses*/ 1 && t1_value !== (t1_value = /*guesses*/ ctx[0].length + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(74:8) {#if gameWon}",
    		ctx
    	});

    	return block;
    }

    // (83:8) {#each Array(maxLives).fill(0) as _, i}
    function create_each_block_4(ctx) {
    	let span;
    	let span_transition;
    	let current;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "❤";
    			attr_dev(span, "class", "life svelte-1w4ku53");
    			toggle_class(span, "lost", /*lives*/ ctx[4] <= /*i*/ ctx[35]);
    			add_location(span, file, 83, 10, 2370);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*lives*/ 16) {
    				toggle_class(span, "lost", /*lives*/ ctx[4] <= /*i*/ ctx[35]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!span_transition) span_transition = create_bidirectional_transition(span, fade, {}, true);
    				span_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!span_transition) span_transition = create_bidirectional_transition(span, fade, {}, false);
    			span_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching && span_transition) span_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_4.name,
    		type: "each",
    		source: "(83:8) {#each Array(maxLives).fill(0) as _, i}",
    		ctx
    	});

    	return block;
    }

    // (95:14) {:else}
    function create_else_block(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			attr_dev(span, "class", "guess-letter blank svelte-1w4ku53");
    			add_location(span, file, 95, 16, 2959);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(95:14) {:else}",
    		ctx
    	});

    	return block;
    }

    // (93:14) {#if guesses.indexOf(letter) > -1}
    function create_if_block_1(ctx) {
    	let span;
    	let t_value = /*letter*/ ctx[25] + "";
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			attr_dev(span, "class", "guess-letter found svelte-1w4ku53");
    			add_location(span, file, 93, 16, 2872);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*answerWords*/ 1024 && t_value !== (t_value = /*letter*/ ctx[25] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(93:14) {#if guesses.indexOf(letter) > -1}",
    		ctx
    	});

    	return block;
    }

    // (91:10) {#each word.split("") as letter}
    function create_each_block_3(ctx) {
    	let div;
    	let show_if;

    	function select_block_type(ctx, dirty) {
    		if (dirty[0] & /*guesses, answerWords*/ 1025) show_if = null;
    		if (show_if == null) show_if = !!(/*guesses*/ ctx[0].indexOf(/*letter*/ ctx[25]) > -1);
    		if (show_if) return create_if_block_1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx, [-1, -1]);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "guess-letter-wrap svelte-1w4ku53");
    			toggle_class(div, "space", /*letter*/ ctx[25] === " ");
    			toggle_class(div, "last", /*lastGuess*/ ctx[8] === /*letter*/ ctx[25] && !/*gameOver*/ ctx[9]);
    			add_location(div, file, 91, 12, 2699);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}

    			if (dirty[0] & /*answerWords*/ 1024) {
    				toggle_class(div, "space", /*letter*/ ctx[25] === " ");
    			}

    			if (dirty[0] & /*lastGuess, answerWords, gameOver*/ 1792) {
    				toggle_class(div, "last", /*lastGuess*/ ctx[8] === /*letter*/ ctx[25] && !/*gameOver*/ ctx[9]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(91:10) {#each word.split(\\\"\\\") as letter}",
    		ctx
    	});

    	return block;
    }

    // (89:6) {#each answerWords as word}
    function create_each_block_2(ctx) {
    	let div;
    	let t;
    	let each_value_3 = /*word*/ ctx[28].split("");
    	validate_each_argument(each_value_3);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			attr_dev(div, "class", "guess-word-row svelte-1w4ku53");
    			add_location(div, file, 89, 8, 2615);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*answerWords, lastGuess, gameOver, guesses*/ 1793) {
    				each_value_3 = /*word*/ ctx[28].split("");
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_3.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(89:6) {#each answerWords as word}",
    		ctx
    	});

    	return block;
    }

    // (104:6) {#each letters.split("") as letter}
    function create_each_block_1(ctx) {
    	let button;
    	let span;
    	let t0_value = /*letter*/ ctx[25] + "";
    	let t0;
    	let t1;
    	let button_disabled_value;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[19](/*letter*/ ctx[25]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(span, "class", "letter-button svelte-1w4ku53");
    			add_location(span, file, 111, 10, 3564);
    			attr_dev(button, "class", "letter-button-wrap svelte-1w4ku53");
    			button.disabled = button_disabled_value = /*guesses*/ ctx[0].includes(/*letter*/ ctx[25]) || /*gameOver*/ ctx[9];
    			toggle_class(button, "correct", (/*lastGuess*/ ctx[8] === /*letter*/ ctx[25] || /*gameOver*/ ctx[9]) && /*answerArray*/ ctx[3].includes(/*letter*/ ctx[25]));
    			toggle_class(button, "incorrect", (/*lastGuess*/ ctx[8] === /*letter*/ ctx[25] || /*gameOver*/ ctx[9]) && /*guesses*/ ctx[0].includes(/*letter*/ ctx[25]) && !/*answerArray*/ ctx[3].includes(/*letter*/ ctx[25]));
    			add_location(button, file, 104, 8, 3177);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, span);
    			append_dev(span, t0);
    			append_dev(button, t1);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler_1, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*guesses, gameOver*/ 513 && button_disabled_value !== (button_disabled_value = /*guesses*/ ctx[0].includes(/*letter*/ ctx[25]) || /*gameOver*/ ctx[9])) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}

    			if (dirty[0] & /*lastGuess, gameOver, answerArray*/ 776) {
    				toggle_class(button, "correct", (/*lastGuess*/ ctx[8] === /*letter*/ ctx[25] || /*gameOver*/ ctx[9]) && /*answerArray*/ ctx[3].includes(/*letter*/ ctx[25]));
    			}

    			if (dirty[0] & /*lastGuess, gameOver, guesses, answerArray*/ 777) {
    				toggle_class(button, "incorrect", (/*lastGuess*/ ctx[8] === /*letter*/ ctx[25] || /*gameOver*/ ctx[9]) && /*guesses*/ ctx[0].includes(/*letter*/ ctx[25]) && !/*answerArray*/ ctx[3].includes(/*letter*/ ctx[25]));
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(104:6) {#each letters.split(\\\"\\\") as letter}",
    		ctx
    	});

    	return block;
    }

    // (121:6) {#if showHint}
    function create_if_block(ctx) {
    	let div;
    	let t;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*hint*/ ctx[11]);
    			attr_dev(div, "class", "hint svelte-1w4ku53");
    			add_location(div, file, 120, 20, 3916);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty[0] & /*hint*/ 2048) set_data_dev(t, /*hint*/ ctx[11]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, {}, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, {}, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(121:6) {#if showHint}",
    		ctx
    	});

    	return block;
    }

    // (125:6) {#each Object.keys(answerCategories) as category}
    function create_each_block(ctx) {
    	let button;
    	let t0_value = answerCategories[/*category*/ ctx[22]].emoji + "";
    	let t0;
    	let t1;
    	let t2_value = /*category*/ ctx[22] + "";
    	let t2;
    	let t3;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[21](/*category*/ ctx[22]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();

    			attr_dev(button, "class", button_class_value = "" + (null_to_empty(`category-btn${/*category*/ ctx[22] === /*activeCategory*/ ctx[6]
			? " active"
			: ""}`) + " svelte-1w4ku53"));

    			add_location(button, file, 125, 8, 4104);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);
    			append_dev(button, t2);
    			append_dev(button, t3);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler_2, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*activeCategory*/ 64 && button_class_value !== (button_class_value = "" + (null_to_empty(`category-btn${/*category*/ ctx[22] === /*activeCategory*/ ctx[6]
			? " active"
			: ""}`) + " svelte-1w4ku53"))) {
    				attr_dev(button, "class", button_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(125:6) {#each Object.keys(answerCategories) as category}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div0;
    	let h1;
    	let t1;
    	let div7;
    	let t2;
    	let div2;
    	let t3;
    	let strong;
    	let t4;
    	let t5;
    	let div1;
    	let t6;
    	let div3;
    	let div3_style_value;
    	let t7;
    	let div4;
    	let t8;
    	let div5;
    	let label;
    	let input;
    	let t9;
    	let t10_value = (/*showHint*/ ctx[7] ? "Hide" : "Show") + "";
    	let t10;
    	let t11;
    	let i;
    	let i_class_value;
    	let t12;
    	let t13;
    	let h2;
    	let t15;
    	let div6;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*gameOver*/ ctx[9] && create_if_block_2(ctx);
    	let each_value_4 = Array(maxLives).fill(0);
    	validate_each_argument(each_value_4);
    	let each_blocks_3 = [];

    	for (let i = 0; i < each_value_4.length; i += 1) {
    		each_blocks_3[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
    	}

    	const out = i => transition_out(each_blocks_3[i], 1, 1, () => {
    		each_blocks_3[i] = null;
    	});

    	let each_value_2 = /*answerWords*/ ctx[10];
    	validate_each_argument(each_value_2);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_2[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value_1 = letters.split("");
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let if_block1 = /*showHint*/ ctx[7] && create_if_block(ctx);
    	let each_value = Object.keys(answerCategories);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "HANGMAN";
    			t1 = space();
    			div7 = element("div");
    			if (if_block0) if_block0.c();
    			t2 = space();
    			div2 = element("div");
    			t3 = text("You have ");
    			strong = element("strong");
    			t4 = text(/*lives*/ ctx[4]);
    			t5 = text(" lives left.\n      ");
    			div1 = element("div");

    			for (let i = 0; i < each_blocks_3.length; i += 1) {
    				each_blocks_3[i].c();
    			}

    			t6 = space();
    			div3 = element("div");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t7 = space();
    			div4 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t8 = space();
    			div5 = element("div");
    			label = element("label");
    			input = element("input");
    			t9 = space();
    			t10 = text(t10_value);
    			t11 = text(" Hint ");
    			i = element("i");
    			t12 = space();
    			if (if_block1) if_block1.c();
    			t13 = space();
    			h2 = element("h2");
    			h2.textContent = "Choose a Category";
    			t15 = space();
    			div6 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(h1, "class", "svelte-1w4ku53");
    			add_location(h1, file, 66, 7, 1820);
    			add_location(div0, file, 66, 2, 1815);
    			add_location(strong, file, 80, 15, 2263);
    			add_location(div1, file, 81, 6, 2306);
    			attr_dev(div2, "class", "guesses-remaining svelte-1w4ku53");
    			add_location(div2, file, 79, 4, 2216);
    			attr_dev(div3, "class", "guess-container svelte-1w4ku53");
    			attr_dev(div3, "style", div3_style_value = `--guess-letter-width: ${100 / /*answerArray*/ ctx[3].length}%`);
    			add_location(div3, file, 87, 4, 2482);
    			attr_dev(div4, "class", "letter-container svelte-1w4ku53");
    			add_location(div4, file, 102, 4, 3096);
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "class", "svelte-1w4ku53");
    			add_location(input, file, 117, 8, 3730);
    			attr_dev(i, "class", i_class_value = "" + (null_to_empty(`fas fa-chevron-${/*showHint*/ ctx[7] ? "up" : "down"}`) + " svelte-1w4ku53"));
    			add_location(i, file, 118, 42, 3822);
    			attr_dev(label, "class", "show-hint-check svelte-1w4ku53");
    			add_location(label, file, 116, 6, 3690);
    			attr_dev(div5, "class", "hint-container svelte-1w4ku53");
    			add_location(div5, file, 115, 4, 3655);
    			add_location(h2, file, 122, 4, 3984);
    			attr_dev(div6, "class", "categories svelte-1w4ku53");
    			add_location(div6, file, 123, 4, 4015);
    			attr_dev(div7, "id", "game");
    			add_location(div7, file, 67, 2, 1845);
    			attr_dev(main, "class", "svelte-1w4ku53");
    			add_location(main, file, 65, 0, 1806);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			append_dev(div0, h1);
    			append_dev(main, t1);
    			append_dev(main, div7);
    			if (if_block0) if_block0.m(div7, null);
    			append_dev(div7, t2);
    			append_dev(div7, div2);
    			append_dev(div2, t3);
    			append_dev(div2, strong);
    			append_dev(strong, t4);
    			append_dev(div2, t5);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks_3.length; i += 1) {
    				each_blocks_3[i].m(div1, null);
    			}

    			append_dev(div7, t6);
    			append_dev(div7, div3);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div3, null);
    			}

    			append_dev(div7, t7);
    			append_dev(div7, div4);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div4, null);
    			}

    			append_dev(div7, t8);
    			append_dev(div7, div5);
    			append_dev(div5, label);
    			append_dev(label, input);
    			input.checked = /*showHint*/ ctx[7];
    			append_dev(label, t9);
    			append_dev(label, t10);
    			append_dev(label, t11);
    			append_dev(label, i);
    			append_dev(div5, t12);
    			if (if_block1) if_block1.m(div5, null);
    			append_dev(div7, t13);
    			append_dev(div7, h2);
    			append_dev(div7, t15);
    			append_dev(div7, div6);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div6, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(window_1, "keydown", /*handleKeydown*/ ctx[14], false, false, false),
    					listen_dev(input, "change", /*input_change_handler*/ ctx[20])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*gameOver*/ ctx[9]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty[0] & /*gameOver*/ 512) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div7, t2);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty[0] & /*lives*/ 16) set_data_dev(t4, /*lives*/ ctx[4]);

    			if (dirty[0] & /*lives*/ 16) {
    				each_value_4 = Array(maxLives).fill(0);
    				validate_each_argument(each_value_4);
    				let i;

    				for (i = 0; i < each_value_4.length; i += 1) {
    					const child_ctx = get_each_context_4(ctx, each_value_4, i);

    					if (each_blocks_3[i]) {
    						each_blocks_3[i].p(child_ctx, dirty);
    						transition_in(each_blocks_3[i], 1);
    					} else {
    						each_blocks_3[i] = create_each_block_4(child_ctx);
    						each_blocks_3[i].c();
    						transition_in(each_blocks_3[i], 1);
    						each_blocks_3[i].m(div1, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_4.length; i < each_blocks_3.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty[0] & /*answerWords, lastGuess, gameOver, guesses*/ 1793) {
    				each_value_2 = /*answerWords*/ ctx[10];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_2(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(div3, null);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_2.length;
    			}

    			if (!current || dirty[0] & /*answerArray*/ 8 && div3_style_value !== (div3_style_value = `--guess-letter-width: ${100 / /*answerArray*/ ctx[3].length}%`)) {
    				attr_dev(div3, "style", div3_style_value);
    			}

    			if (dirty[0] & /*guesses, gameOver, lastGuess, answerArray, guessLetter*/ 4873) {
    				each_value_1 = letters.split("");
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div4, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty[0] & /*showHint*/ 128) {
    				input.checked = /*showHint*/ ctx[7];
    			}

    			if ((!current || dirty[0] & /*showHint*/ 128) && t10_value !== (t10_value = (/*showHint*/ ctx[7] ? "Hide" : "Show") + "")) set_data_dev(t10, t10_value);

    			if (!current || dirty[0] & /*showHint*/ 128 && i_class_value !== (i_class_value = "" + (null_to_empty(`fas fa-chevron-${/*showHint*/ ctx[7] ? "up" : "down"}`) + " svelte-1w4ku53"))) {
    				attr_dev(i, "class", i_class_value);
    			}

    			if (/*showHint*/ ctx[7]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty[0] & /*showHint*/ 128) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div5, null);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (dirty[0] & /*activeCategory, changeCategory*/ 32832) {
    				each_value = Object.keys(answerCategories);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div6, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);

    			for (let i = 0; i < each_value_4.length; i += 1) {
    				transition_in(each_blocks_3[i]);
    			}

    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			each_blocks_3 = each_blocks_3.filter(Boolean);

    			for (let i = 0; i < each_blocks_3.length; i += 1) {
    				transition_out(each_blocks_3[i]);
    			}

    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			destroy_each(each_blocks_3, detaching);
    			destroy_each(each_blocks_2, detaching);
    			destroy_each(each_blocks_1, detaching);
    			if (if_block1) if_block1.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const maxLives = 10;
    const letters = "abcdefghijklmnopqrstuvwxyz";

    function instance($$self, $$props, $$invalidate) {
    	let hint;
    	let answer;
    	let answerArray;
    	let answerWords;
    	let wrongGuesses;
    	let lives;
    	let gameLost;
    	let gameWon;
    	let gameOver;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let activeCategory = getRandomCategory();
    	let answerAndHint = getAnswerFromCategory(activeCategory);
    	let guesses = [];
    	let showHint = true;
    	let lastGuess = null;

    	function guessLetter(letter) {
    		if (!gameOver && !guesses.includes(letter)) {
    			$$invalidate(0, guesses = [...guesses, letter]);
    			$$invalidate(8, lastGuess = letter);
    		}
    	}

    	const restartGame = (category = activeCategory) => {
    		$$invalidate(0, guesses = []);
    		$$invalidate(7, showHint = false);
    		$$invalidate(8, lastGuess = null);
    		$$invalidate(16, answerAndHint = getAnswerFromCategory(category));
    	};

    	function handleKeydown(event) {
    		if (event.metakey || event.ctrlKey || event.altKey) {
    			return;
    		} else if (gameOver) {
    			if (event.key === "Enter" || event.key === "Space") {
    				restartGame();
    			}
    		} else if (event.keyCode >= 65 && event.keyCode <= 90) {
    			const letter = event.key.toLowerCase();
    			const index = letters.indexOf(letter);

    			if (index > -1) {
    				guessLetter(letter);
    			}
    		}
    	}

    	function changeCategory(category) {
    		$$invalidate(6, activeCategory = category);
    		restartGame(category);
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => restartGame();
    	const click_handler_1 = letter => guessLetter(letter);

    	function input_change_handler() {
    		showHint = this.checked;
    		$$invalidate(7, showHint);
    	}

    	const click_handler_2 = category => changeCategory(category);

    	$$self.$capture_state = () => ({
    		answerCategories,
    		fade,
    		fly,
    		slide,
    		getAnswerFromCategory,
    		getRandomCategory,
    		maxLives,
    		letters,
    		activeCategory,
    		answerAndHint,
    		guesses,
    		showHint,
    		lastGuess,
    		guessLetter,
    		restartGame,
    		handleKeydown,
    		changeCategory,
    		gameOver,
    		gameWon,
    		gameLost,
    		answerArray,
    		lives,
    		wrongGuesses,
    		answer,
    		answerWords,
    		hint
    	});

    	$$self.$inject_state = $$props => {
    		if ('activeCategory' in $$props) $$invalidate(6, activeCategory = $$props.activeCategory);
    		if ('answerAndHint' in $$props) $$invalidate(16, answerAndHint = $$props.answerAndHint);
    		if ('guesses' in $$props) $$invalidate(0, guesses = $$props.guesses);
    		if ('showHint' in $$props) $$invalidate(7, showHint = $$props.showHint);
    		if ('lastGuess' in $$props) $$invalidate(8, lastGuess = $$props.lastGuess);
    		if ('gameOver' in $$props) $$invalidate(9, gameOver = $$props.gameOver);
    		if ('gameWon' in $$props) $$invalidate(1, gameWon = $$props.gameWon);
    		if ('gameLost' in $$props) $$invalidate(2, gameLost = $$props.gameLost);
    		if ('answerArray' in $$props) $$invalidate(3, answerArray = $$props.answerArray);
    		if ('lives' in $$props) $$invalidate(4, lives = $$props.lives);
    		if ('wrongGuesses' in $$props) $$invalidate(17, wrongGuesses = $$props.wrongGuesses);
    		if ('answer' in $$props) $$invalidate(5, answer = $$props.answer);
    		if ('answerWords' in $$props) $$invalidate(10, answerWords = $$props.answerWords);
    		if ('hint' in $$props) $$invalidate(11, hint = $$props.hint);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*answerAndHint*/ 65536) {
    			$$invalidate(11, hint = answerAndHint[1]);
    		}

    		if ($$self.$$.dirty[0] & /*answerAndHint*/ 65536) {
    			$$invalidate(5, answer = answerAndHint[0]);
    		}

    		if ($$self.$$.dirty[0] & /*answer*/ 32) {
    			window.answer = answer;
    		}

    		if ($$self.$$.dirty[0] & /*answer*/ 32) {
    			$$invalidate(3, answerArray = answer?.split("") || []);
    		}

    		if ($$self.$$.dirty[0] & /*answer*/ 32) {
    			$$invalidate(10, answerWords = answer?.split(" ") || []);
    		}

    		if ($$self.$$.dirty[0] & /*guesses, answerArray*/ 9) {
    			$$invalidate(17, wrongGuesses = guesses.filter(letter => answerArray.indexOf(letter) === -1));
    		}

    		if ($$self.$$.dirty[0] & /*wrongGuesses*/ 131072) {
    			$$invalidate(4, lives = maxLives - wrongGuesses.length);
    		}

    		if ($$self.$$.dirty[0] & /*lives*/ 16) {
    			$$invalidate(2, gameLost = lives <= 0);
    		}

    		if ($$self.$$.dirty[0] & /*answerArray, guesses*/ 9) {
    			$$invalidate(1, gameWon = answerArray.every(letter => guesses.includes(letter) || letter === " "));
    		}

    		if ($$self.$$.dirty[0] & /*gameLost, gameWon*/ 6) {
    			$$invalidate(9, gameOver = gameLost || gameWon);
    		}
    	};

    	return [
    		guesses,
    		gameWon,
    		gameLost,
    		answerArray,
    		lives,
    		answer,
    		activeCategory,
    		showHint,
    		lastGuess,
    		gameOver,
    		answerWords,
    		hint,
    		guessLetter,
    		restartGame,
    		handleKeydown,
    		changeCategory,
    		answerAndHint,
    		wrongGuesses,
    		click_handler,
    		click_handler_1,
    		input_change_handler,
    		click_handler_2
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
