<svelte:options tag="model-viewer-pq" />

<script>
	//import ModelViewer from "@google/model-viewer";
	import { onMount } from "svelte";

	export let src = "";
	export let color = 0x999999;
	export let options = {
		"auto-rotate": false,
		"camera-controls": false,
		"max-field-of-view": "90deg",
		// "shadow-intensity": "0.9",
		// "shadow-softness": "0.1",
	};

	// external scripts loaded
	let loaded = false;
	let loadCount = 0;
	function scriptLoaded() {
		loadCount += 1;
		if (loadCount >= 4) {
			loaded = true;
		}
	}

	// component mounted
	let mounted = false;
	onMount(function () {
		mounted = true;
	});

	// component src set
	let modelViewer;
	$: if (mounted && loaded && src) {
		blobFromSTL(src, function (res) {
			modelViewer.src = res;
		});
	}

	function blobFromSTL(url, resolve) {
		const loader = new THREE.STLLoader();

		const onParse = function (data) {
			const str = JSON.stringify(data);
			const blob = new Blob([str], { type: "text/plain" });
			return resolve(URL.createObjectURL(blob));
		};

		const onLoad = function (geometry) {
			const material = new THREE.MeshPhongMaterial({ color });
			const object = new THREE.Mesh(geometry, material);
			const exporter = new THREE.GLTFExporter();
			exporter.parse(object, onParse);
		};

		loader.load(url, onLoad);
	}
</script>

<svelte:head>
	<script
		src="https://unpkg.com/@google/model-viewer@1.6.0/dist/model-viewer-umd.js"
		on:load={scriptLoaded}></script>
	{{
		/* threejs is not exposed by modelviewer.dev ... */
	}}
	<script
		src="https://unpkg.com/three@0.126.1/build/three.min.js"
		on:load={scriptLoaded}></script>
	{#if loadCount >= 2}
		<script
			src="https://unpkg.com/three@0.126.1/examples/js/exporters/GLTFExporter.js"
			on:load={scriptLoaded}></script>
		<script
			src="https://unpkg.com/three@0.126.1/examples/js/loaders/STLLoader.js"
			on:load={scriptLoaded}></script>
	{/if}
</svelte:head>

<model-viewer bind:this={modelViewer} {...options} {...$$restProps} />

<style>
	model-viewer {
		height: 100%;
		width: 100%;
	}
</style>
