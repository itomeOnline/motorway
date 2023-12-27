import Swiper, {
    Navigation,
    Scrollbar,
    Mousewheel,
    Pagination,
    EffectFade,
    Autoplay,
    Virtual
} from 'swiper';
  
import 'swiper/swiper.min.css';

const carsPricesCatalog = (_ => {
    const DOM = {};
    const data = [];
    const state = {
        current: null,
        data: null
    }
    const init = data => {
        state.data = data;
        state.current = data[0];
        cacheDOM();
        bindEventListeners();
        render();
        console.log(state);
    }
    const cacheDOM = _ => {
        DOM.container = document.querySelector('[data-catalog-prices-root]');
        DOM.categoryBtnsContainer = DOM.container.querySelector('[data-catalog-prices-btns]');
        DOM.categoryContent = DOM.container.querySelector('[data-catalog-prices-content]');
    }
    const bindEventListeners = _ => {
        DOM.container.addEventListener('catalog::categoryChanged', handleCategoryChange);
    }

    
    const handleCategoryChange = async ({detail}) => {
        const {id, btn} = detail;
        if (btn.classList.contains('is-active')) return

        const {categoryContent, categoryBtnsContainer} = DOM;
        const btns = categoryBtnsContainer.querySelectorAll('.best_offers__tabs_btn');
        const activeBtn = [...btns].find(btn => btn.classList.contains('is-active'));
        activeBtn.classList.remove('is-active');
        btn.classList.add('is-active');
        
        state.current = state.data.find(category => category.id === id);
        await hideElem(categoryContent)
        
        renderCategoryContent();
        showEl(categoryContent);        
    }



    const hideElem = el => {
        el.classList.remove('is-active')
        
        return new Promise((res, rej) => {
            el.addEventListener('transitionend', ({target}) => {
                if (target.isSameNode(el)) res()
            })
        });
        
    }

   
    const render = _ => {
        renderBtns(); 
        renderCategoryContent();
        showEl(DOM.categoryContent);
    }
    
    const renderBtns = _ => {
        const { container, categoryBtnsContainer } = DOM;
        categoryBtnsContainer.innerHTML = '';
        state.data
            .map(category => {
                const btn = document.createElement('button');
                const {id, title} = category;
                btn.classList.add('best_offers__tabs_btn');
                if (state.current.id === id) btn.classList.add('is-active');
                btn.innerHTML = `
                    <span class="n-catalog_btn__text">${title}</span>
                `;
                btn.addEventListener('click', _ => {
                    const detail = {
                        id: id,
                        btn: btn
                    }
                    const evt = new CustomEvent('catalog::categoryChanged', {detail: detail});

                    container.dispatchEvent(evt);
                });
                return btn;
             
            })
            .forEach(btn => {
                categoryBtnsContainer.appendChild(btn)
            })
        
        
    }

    const renderCategoryContent = _ => {
        const { categoryContent } = DOM;
        const { current } = state;
        const { slug } = current;
        const { country } = current;

        
        
        categoryContent.innerHTML = `
            <div class="best_offers__slider slider swiper"> 
                <div class="swiper-wrapper">
                    ${current.cars.reduce((html, car, i) => {
                        const { id, brand, params, price } = car;
                        return html += `
                        <div class="best_offers_slide swiper-slide" data-id=${id}>
                            <div class="best_offers_slide__img">
                                <img class="image" src="/assets/img/catalog/${country}/${slug}/${id}.jpg">
                            </div>
                            <div class="best_offers_slide__info"> 
                                <p class="best_offers_slide__price">${price}</p>
                                <p class="best_offers_slide__text">${brand}</p>
                                <p class="best_offers_slide__text best_offers_slide__text--params">${params}</p>
                                <button class="best_offers_slide__btn btn btn--filled"  data-modal-set-inputs="[{"key":"model","value":"${brand}"}]" data-linked-modal="modal_similar">Подобрать похожий</button>
                            </div>
                        </div>
                        `;
                    }, '')}

                </div>
                <div class="slider__nav best_offers__nav grid">
                    
                    <div class="slider__buttons best_offers__nav_buttons">
                        <button class="slider__button slider__button--prev best_offers__slider_btn--prev">
                            <svg>
                            <use xlink:href="#arrow_slider"></use>
                            </svg>
                        </button>
                        <button class="slider__button slider__button--next best_offers__slider_btn--next">
                            <svg>
                            <use xlink:href="#arrow_slider"></use>
                            </svg>
                        </button>
                    </div>
                    
                </div>
            </div>
            
        `;
        // categoryContent.querySelectorAll('.n-catalog_slider__slide').forEach(slide => {
        //     slide.addEventListener('mouseover', _ => {
        //         setCarInForm({
        //             ...current.cars.find(car => +car.id === +slide.dataset.id),
        //             pic: `/themes/itome/assets/img/catalog/${slug}/${slide.dataset.id}.jpg`
        //         })  
        //     });
        // });


        const swiper = new Swiper(categoryContent.querySelector('.swiper'), {
            modules: [ Navigation, Scrollbar, Mousewheel],
            slidesPerView: 3,
            speed: 700,
            spaceBetween: 28,
            watchOverflow: true,
            mousewheelControl: true,
            mousewheel: {
            forceToAxis: true,
            },
            navigation: {
                nextEl: categoryContent.querySelector('.best_offers__slider_btn--next'),
                prevEl: categoryContent.querySelector('.best_offers__slider_btn--prev'),
            },
            breakpoints: {
                300: {
                    slidesPerView: 1,
                    spaceBetween: 16
                },
                600: {
                    slidesPerView: 2,
                    spaceBetween: 20
                },
                1280: {
                    slidesPerView: 3,
                    spaceBetween: 28
                },
            },
            
        });
        		
        setTimeout(_ => {
            swiper.update()
        }, 200)
        
        
    }
    const showEl = el => {
        el.classList.add('is-active');
    }


    return {
        init: init
    }
})();

export default carsPricesCatalog;
