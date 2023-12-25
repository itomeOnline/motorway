function faqDropdown() {
    const block = document.querySelectorAll('[data-dropdown-block]');
    

    block.forEach(el => {
        const btn = el.querySelector('[data-dropdown-btn]');

        btn.addEventListener('click', _ => {
            el.classList.toggle('is-open');
        })
    })
}

export default faqDropdown;