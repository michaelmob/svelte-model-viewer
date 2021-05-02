<script>
	import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
	import Component from "../Component.svelte";

	let files;
	let file = "http://localhost:6006/xyzCalibration_cube.stl";
	$: if (files && files[0]) {
		file = URL.createObjectURL(files[0]);
	}
</script>

<Meta
	title="Example/Component"
	component={Component}
	argTypes={{
		src: {
			control: "text",
			default: "",
		},
	}}
/>
<div>
	<label for="file">Upload an STL model:</label>
	<input id="file" type="file" bind:files />
</div>

<button
	on:click={() => {
		file = "http://localhost:6006/xyzCalibration_cube.stl";
	}}
>CaliCube</button>

<Template let:args>
	<div style="height: 250px; width: 250px">
		<Component {...args} bind:src={file} />
	</div>
</Template>

<Story
	name="Primary"
	args={{
		primary: true,
		label: "Component",
	}}
/>
