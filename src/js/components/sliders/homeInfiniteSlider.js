import Swiper, {
    Navigation,
    Scrollbar,
    Mousewheel,
    Pagination,
    EffectFade,
    Autoplay,
    Virtual,
    Parallax,
    Lazy
  } from 'swiper';
  
import 'swiper/swiper.min.css';
import 'swiper/modules/scrollbar/scrollbar.min.css';

function homeInfiniteSlider () {
    const slider = new Swiper('.home_infinite_slider', {
      modules: [ Navigation, Scrollbar, Mousewheel, Autoplay],
      slidesPerView: 'auto',
	    speed: 2000,
	    spaceBetween: 140,
	    loop: true,
	    autoplay: {
	      delay: 0,
	    },
      loopedSlides: 0,
	    breakpoints: {
        300: {
          spaceBetween: 80
        },
        600: {
          spaceBetween: 120
        },
        1280: {
          spaceBetween: 140
        },
      },        
      });
}

export default homeInfiniteSlider;