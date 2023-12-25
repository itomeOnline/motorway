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
// import 'swiper/components/scrollbar/scrollbar.min.css';

function teamSlider () {
    const slider = new Swiper('.team__slider', {
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
            nextEl: '.team__slider_btn--next',
            prevEl: '.team__slider_btn--prev',
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
          // 1700: {
          //   slidesPerView: 4,
          //   spaceBetween: 28
          // },
        },
    });
}

export default teamSlider;