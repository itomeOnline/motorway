export default class InputPhone {
    constructor(el) {
        this.el = el;
        this.addEventListeners();
        this.mask = null;
        
    }
    addEventListeners() {
        this.el.addEventListener('focus', this.createImask.bind(this));
        this.el.addEventListener('blur', this.destroyImask.bind(this));
    }

    createImask() {
        this.mask = IMask(this.el, {
			mask: '+{7} (000) 000-00-00',
			lazy: !0,
            prepare: (appended, masked) => {
                if (appended === '8' && masked.value === '') {
                    return '';
                }
                return appended;
            },
		});

        console.log(this.el.value);

        // if (this.mask.unmaskedValue === "") {
        //     this.mask.unmaskedValue = '7('
        // }
    }

    destroyImask() {
        if (this.mask && this.mask.unmaskedValue.length < 11) {
			this.mask.destroy();
			this.el.value = '';
            this.el.classList.remove('is-filled');
		}
    }

}
