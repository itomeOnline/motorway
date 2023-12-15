import { validationMessages } from './validationMessages';



export default class Input {
    constructor(el, obj) {
        this.el = el;
        this.obj = obj;
        this.addEventListeners();
    }

    addEventListeners() {
        this.el.addEventListener('blur', this.validationOptions.bind(this));
        this.el.addEventListener('input', this.fillInput.bind(this));
    }

    validationOptions() {
        for (let key in this.el.validity) {
			if (key !== 'valid' && this.el.validity[key]) {
            
                const type = this.obj[key][this.el.type] ? this.el.type : 'default';
                const message = this.obj[key][type];

                this.renderTooltip(message);
                this.addValidation();
			}
		}
    }

    addValidation() {
        this.el.closest('[data-input-wrapper]').classList.add('not-valid');
    }

    removeValidation() {
        this.el.closest('[data-input-wrapper]').classList.remove('not-valid');
    }

    renderTooltip(message) {
        this.el.closest('[data-input-wrapper]').querySelector('[data-input-tooltip]').innerHTML = `${message}`;
    }

    fillInput() {
        this.el.classList.add('is-filled');

        if (this.el.value === '' ) {
			this.el.classList.remove('is-filled');
		}

		this.removeValidation();
    }
}