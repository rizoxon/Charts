export default class Line extends HTMLElement{
	#data;
	#canvas;
	#ctx;
	#tooltip;

	#text_color = "black";
	#grid_color = "gray";
	#main_axis_color ="black";
	#font_size = 11;

	#padding = 50;
	#paddings;
	#min_value = Infinity;
	#max_value = -Infinity;
	#longest_dataset = 0;
	#gap_x_axis = 0;
	#gap_y_axis = 0;
	#scale_y;
	#marker_size = 10;
	#marker_count_y_axis = 10;
	#y_axis_step_value;
	#circle_rad = 4;
	#grid_line_width = 0.1;

	#canvas_DPI_width = 0;
	#canvas_DPI_height = 0;

	constructor(){
		super();

		this.shadow = this.attachShadow({mode: 'closed'});
		this.#data = JSON.parse(this.innerHTML);

		// Style element
		const style = document.createElement('style');
		style.textContent = `
			:host{
				display: inline-block;
				width: 100%;
				height: 100%;
				max-width: 100dvw;
				max-height: 100dvh;
			}
			canvas{
				width: 100%;
				height: 100%;
			}
			div#XE_charts_line_tooltip{
				position: absolute;
				display: none;
				background-color: rgba(0, 0, 0, 0.7);
				color: white;
				padding: 5px;
				border-radius: 5px;
				pointer-events: none;
				font-size: 0.7em;
			}
		`;
		this.shadow.appendChild(style);

		// Tooltip element
		this.#tooltip = document.createElement("div");
		this.#tooltip.setAttribute("id", "XE_charts_line_tooltip");
		this.shadow.appendChild(this.#tooltip);

		// Canvas element
		this.shadow.appendChild(document.createElement("canvas"));
		this.#canvas = this.shadow.querySelector("canvas");
		this.#ctx = this.#canvas.getContext('2d');

		this.#resize_observer();

		this.#init_on_hover_points();
	}

	////// APIs
	#resize_observer(){
		const resize_observer_object = new ResizeObserver(this.#draw);
		resize_observer_object.observe(this.parentNode);
	}

	#draw = ()=>{
		this.#update_colors();
		this.#set_up_canvas();
		this.#set_values();

		if("legends" in this.#data && this.#data["legends"] === true) this.#draw_legends();
		if("grid" in this.#data){
			if("horizontal" in this.#data["grid"] && this.#data["grid"]["horizontal"]) this.#draw_x_lines();
			if("vertical" in this.#data["grid"] && this.#data["grid"]["vertical"]) this.#draw_y_lines();
		}

		if("fill_type" in this.#data){
			if(this.#data["fill_type"] === "plain" || this.#data["fill_type"] === "opacity") this.#draw_opacity_or_plain_background();
			if(this.#data["fill_type"] === "gradient") this.#draw_gradient_background();
		}

		if("x_axis" in this.#data && "label" in this.#data["x_axis"] && this.#data["x_axis"]["label"]){
			this.#draw_main_x_axis();
			this.#draw_markers_x_axis();
		}

		if("y_axis" in this.#data && "label" in this.#data["y_axis"] && this.#data["y_axis"]["label"]){
			this.#draw_main_y_axis();
			this.#draw_markers_y_axis();
		}

		this.#draw_lines();
		if("data_points" in this.#data && this.#data["data_points"] === true) this.#draw_circle();
	}

	////// Helpers
	#update_colors(){
		this.#text_color = getComputedStyle(document.querySelector(':root')).getPropertyValue("--color-text-primary");
		this.#grid_color = getComputedStyle(document.querySelector(':root')).getPropertyValue("--color-text-secondary");
		this.#main_axis_color = getComputedStyle(document.querySelector(':root')).getPropertyValue("--color-text-primary");
	}

	#set_up_canvas(){
		const DPR = window.devicePixelRatio || 1;

		// First set CSS dimensions
		this.#canvas.style.width = '100%';
		this.#canvas.style.height = '100%';

		// Get the size in CSS pixels after CSS is applied
		const computed_style = getComputedStyle(this.#canvas);
		const css_width = parseFloat(computed_style.width);
		const css_height = parseFloat(computed_style.height);

		// Get the sizes before DPI scaling for calcs
		this.#canvas_DPI_width = css_width;
		this.#canvas_DPI_height = css_height;

		// Adjust canvas buffer size for DPR
		this.#canvas.width = css_width * DPR;
		this.#canvas.height = css_height * DPR;

		// Scale the context for DPR
		this.#ctx.scale(DPR, DPR);
	}

	#set_values(){
		// Marker count Y axis
		if("y_axis" in this.#data && "marker_count" in this.#data["y_axis"]) this.#marker_count_y_axis = this.#data["y_axis"]["marker_count"];

		// Finding min max
		for(let i = 0; i < this.#data["data"].length; i++){
			const min = Math.min(...this.#data["data"][i]["values"]);
			const max = Math.max(...this.#data["data"][i]["values"]);
			if(min < this.#min_value) this.#min_value = min;
			if(max > this.#max_value) this.#max_value = max;

			// Longest dataset
			if(this.#data["data"][i]["values"].length > this.#longest_dataset) this.#longest_dataset = this.#data["data"][i]["values"].length;
		}

		this.#paddings = {
			top: this.#padding,
			right: this.#canvas_DPI_width - this.#padding,
			bottom: this.#canvas_DPI_height - this.#padding,
			left: this.#padding
		};

		this.#gap_x_axis = (this.#paddings.right - this.#padding) / (this.#longest_dataset - 1);
		this.#gap_y_axis = (this.#paddings.bottom - this.#padding) / (this.#marker_count_y_axis - 1);
		this.#scale_y = (this.#canvas_DPI_height - this.#padding * 2) / (this.#max_value - this.#min_value);

		this.#y_axis_step_value = (this.#max_value - this.#min_value) / (this.#marker_count_y_axis - 1);
	}

	#draw_main_x_axis(){
		this.#ctx.beginPath();

		this.#ctx.moveTo(this.#paddings.left, this.#paddings.bottom);
		this.#ctx.lineTo(this.#paddings.right, this.#paddings.bottom);

		this.#ctx.strokeStyle = this.#main_axis_color;
		this.#ctx.lineWidth = 1;
		this.#ctx.stroke();
	}

	#draw_main_y_axis(){
		this.#ctx.beginPath();

		this.#ctx.moveTo(this.#paddings.left, this.#paddings.top);
		this.#ctx.lineTo(this.#paddings.left, this.#paddings.bottom);

		this.#ctx.strokeStyle = this.#main_axis_color;
		this.#ctx.lineWidth = 1;
		this.#ctx.stroke();
	}

	#draw_markers_x_axis(){
		for(let i = 0; i < this.#longest_dataset; i++){
			const x = i * this.#gap_x_axis + this.#padding;

			this.#ctx.textAlign = "center";
			this.#ctx.font = " 11px 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
			this.#ctx.fillStyle = this.#text_color;
			this.#ctx.fillText(i, x, this.#paddings.bottom + this.#marker_size * 1.5);
		}
	}

	#draw_markers_y_axis(){
		for(let i = 0; i < this.#marker_count_y_axis; i++){
			this.#ctx.textAlign = "right";
			this.#ctx.fillStyle = this.#text_color;
			this.#ctx.font = " 11px 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
			this.#ctx.textBaseline = "middle";
			this.#ctx.fillText((this.#max_value - i * this.#y_axis_step_value).toFixed(1), this.#paddings.left - this.#marker_size * 1.5, i * this.#gap_y_axis + this.#padding);
		}
	}

	#draw_x_lines(){
		this.#ctx.strokeStyle = this.#grid_color;
		this.#ctx.lineWidth = this.#grid_line_width;

		for (let i = 0; i < this.#marker_count_y_axis; i++) {
			this.#ctx.beginPath();
			this.#ctx.moveTo(this.#paddings.left - this.#marker_size, this.#gap_y_axis * i + this.#padding);
			this.#ctx.lineTo(this.#paddings.right, this.#gap_y_axis * i + this.#padding);
			this.#ctx.stroke();
		}
	}

	#draw_y_lines(){
		this.#ctx.strokeStyle = this.#grid_color;
		this.#ctx.lineWidth = this.#grid_line_width;

		for(let i = 0; i < this.#longest_dataset; i++){
			const x = i * this.#gap_x_axis + this.#padding;
			this.#ctx.beginPath();
			this.#ctx.moveTo(x, this.#paddings.top);
			this.#ctx.lineTo(x, this.#paddings.bottom + this.#marker_size);
			this.#ctx.stroke();
		}
	}

	#draw_lines(){
		this.#ctx.lineWidth = 2;

		for(let i = 0; i < this.#data["data"].length; i++){
			this.#ctx.beginPath();
			this.#ctx.moveTo(this.#paddings.left, this.#paddings.bottom - (this.#data["data"][i]["values"][0] - this.#min_value) * this.#scale_y);
			this.#ctx.strokeStyle = this.#data["data"][i]["color"] ?? this.#text_color;

			for(let j = 0; j < this.#data["data"][i]["values"].length; j++){
				this.#ctx.lineTo(
					j * this.#gap_x_axis + this.#padding,
					this.#paddings.bottom - (this.#data["data"][i]["values"][j] - this.#min_value) * this.#scale_y
				);
			}

			this.#ctx.stroke();
		}
	}

	#draw_circle(){
		for (let i = 0; i < this.#data["data"].length; i++) {
			const values = this.#data["data"][i]["values"];

			for(let j = 0; j < values.length; j++){
				const x = j * this.#gap_x_axis + this.#padding;
				const y = this.#paddings.bottom - (values[j] - this.#min_value) * this.#scale_y;
				this.#ctx.beginPath();
				this.#ctx.fillStyle = this.#data["data"][i]["color"] ?? this.#text_color;
				this.#ctx.arc(x, y, this.#circle_rad, 0, Math.PI * 2);
				this.#ctx.fill();
			}
		}
	}

	#draw_opacity_or_plain_background(){
		for(let i = 0; i < this.#data["data"].length; i++){
			this.#ctx.beginPath();

			for(let j = 0; j <= this.#data["data"][i]["values"].length; j++){
				this.#ctx.lineTo(
					j * this.#gap_x_axis + this.#padding,
					this.#paddings.bottom - (this.#data["data"][i]["values"][j] - this.#min_value) * this.#scale_y
				);

				if(j == this.#data["data"][i]["values"].length){
					this.#ctx.lineTo(this.#paddings.right, this.#paddings.bottom);
					this.#ctx.lineTo(this.#paddings.left, this.#paddings.bottom);
					this.#ctx.fillStyle = this.#data["data"][i]["color"] ?? this.#text_color;
					this.#ctx.globalAlpha = this.#data["fill_type"] === "plain" ? 1 : 0.1;
					this.#ctx.closePath();
				}
			}
			this.#ctx.fill();
		}
		this.#ctx.globalAlpha = 1;
	}

	#draw_gradient_background(){
		this.#ctx.globalAlpha = 0.5;

		for(let i = 0; i < this.#data["data"].length; i++){
			this.#ctx.beginPath();

			const gradient = this.#ctx.createLinearGradient(
				this.#padding,
				this.#paddings.bottom - (Math.max(...this.#data["data"][i]["values"]) - this.#min_value) * this.#scale_y,
				// this.#paddings.top,
				this.#padding,
				this.#paddings.bottom
			);
			gradient.addColorStop(0, this.#data["data"][i]["color"]);
			gradient.addColorStop(1, "rgba(255, 255, 255, 0");
			this.#ctx.fillStyle = gradient;

			for(let j = 0; j <= this.#data["data"][i]["values"].length; j++){

				this.#ctx.lineTo(
					j * this.#gap_x_axis + this.#padding,
					this.#paddings.bottom - (this.#data["data"][i]["values"][j] - this.#min_value) * this.#scale_y
				);

				if(j == this.#data["data"][i]["values"].length){
					this.#ctx.lineTo(this.#paddings.right, this.#paddings.bottom);
					this.#ctx.lineTo(this.#paddings.left, this.#paddings.bottom);
					this.#ctx.closePath();
				}

			}
			this.#ctx.fill();
		}

		this.#ctx.globalAlpha = 1;
	}

	#draw_legends(){
		const rectWidth = 20;
		const rectHeight = 10;
		const gap = 30;

		const posY = this.#paddings.bottom + this.#padding / 1.5;

		// put to the center (x axis)
		let startX = (this.#canvas_DPI_width) / 2;

		// - text widths
		for(let i = 0; i < this.#data["data"].length; i++)
			startX -= this.#ctx.measureText(this.#data["data"][i]["label"]).width / 2;

		// - rectangles
		startX -= this.#data["data"].length * rectWidth / 2;

		// - Gaps
		startX -= (this.#data["data"].length - 1) * gap / 2;

		for(let i = 0; i < this.#data["data"].length; i++){
			this.#ctx.fillStyle = this.#data["data"][i]["color"];

			this.#ctx.fillRect(startX, posY, rectWidth, rectHeight);

			this.#ctx.textBaseline = "top";
			this.#ctx.textAlign = "left";
			this.#ctx.font = `bold ${this.#font_size}px 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif`;
			this.#ctx.fillText(this.#data["data"][i]["label"], startX + gap, posY);

			startX += rectWidth + this.#ctx.measureText(this.#data["data"][i]["label"]).width + gap;
		}
	}

	#init_on_hover_points(){
		if(this.#data["data_points"] !== true) return;

		this.#canvas.addEventListener('mousemove', (event) => {
			const rect = this.#canvas.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;
			const mouseY = event.clientY - rect.top;

			let hovered_point = null;
			let min_distance = Infinity;

			for(const line of this.#data["data"]){
				for(let i = 0; i < line["values"].length; i++){
					const x = i * this.#gap_x_axis + this.#padding;
					const y = this.#paddings.bottom - (line["values"][i] - this.#min_value) * this.#scale_y;

					// Calculate distance from mouse to point
					const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));

					// If this point is closer than previous closest point
					if (distance < min_distance && distance < this.#marker_size) {
						min_distance = distance;
						hovered_point = { label: line["label"], value: line["values"][i] };
					}
				}
			}

			if(hovered_point != null) {
				let tooltip_height = this.#tooltip.getBoundingClientRect().height;
				this.#tooltip.style.display = 'block';
				this.#tooltip.style.left = event.pageX + "px";
				this.#tooltip.style.top = event.pageY - tooltip_height - 5 + "px";
				this.#tooltip.textContent = `${hovered_point["label"]}: ${hovered_point["value"].toFixed(0)}`;
			}

			else { this.#tooltip.style.display = 'none'; }
		});
	}
}

window.customElements.define('x-line-chart', Line);