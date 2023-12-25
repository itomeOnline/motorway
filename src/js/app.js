import LazyLoad from "vanilla-lazyload";
import LocomotiveScroll from 'locomotive-scroll';
import InputPhone from "./components/inputs/inputPhone";
import Input from "./components/inputs/input";
import validationMessages from "./components/inputs/validationMessages";
import IMask from "imask";
import SimpleBar from "simplebar";
import "simplebar/dist/simplebar.css";
import ModalDispatcher from "./components/modalDispatcher";
import formSubmit from "./components/form";
import activeLink from "./components/activeLink";
import genInfoSlider from "./components/sliders/genInfoSlider";
import reviewsSlider from "./components/sliders/reviewsSlider";
import contactsMap from "./components/contactsMap";
import faqDropdown from "./components/faqDropdown";
import teamSlider from "./components/sliders/teamSlider";
import homeInfiniteSlider from "./components/sliders/homeInfiniteSlider";
import carsCatalog from "./components/carsCatalog";
import advanSlider from "./components/sliders/advanSlider";

setTimeout(() => { 
    document.querySelector('body').classList.add('on-loaded');
}, 1000)

document.addEventListener("DOMContentLoaded", _ => {
    if (!sessionStorage.activeSession) {
        
        setTimeout(() => {
            document.querySelector('body').classList.add('disabled');
        }, 4800)
        
        sessionStorage.activeSession = 1;
    } else {
        document.querySelector('body').classList.add('disabled');
    }

    formSubmit();
    ModalDispatcher.init();
    activeLink();
    faqDropdown();

    genInfoSlider();
    reviewsSlider();
    teamSlider();
    homeInfiniteSlider();
    advanSlider();

    if (document.querySelector('.best_offers--japan')) {

        (async _ => {
            const res = await fetch('/js/catalogsData/japanData.json');
            const cars = await res.json();
            carsCatalog.init(cars);
        })();
    }

    


    

    const initMap = () => {

        let script = document.createElement('script');
        let link = document.createElement('link');

        link.rel = "stylesheet";
        link.href = "https://api.mapbox.com/mapbox-gl-js/v2.11.0/mapbox-gl.css";
        document.head.append(link);

        script.async = true;
        script.src = "https://api.mapbox.com/mapbox-gl-js/v2.11.0/mapbox-gl.js";
        document.head.append(script);

        script.onload = function () {
            
            if (document.querySelector('#contactsMap')) {
                contactsMap(document.querySelector('#contactsMap'));
            }
        }
        
    }

    initMap();

    let scroll = new LocomotiveScroll({ 
        getDirection: true,
    });
    
    const lazyLoadInstance = new LazyLoad({
        elements_selector: '[data-lazy]'
    });

    setTimeout( _ => {
        scroll.update();


        scroll.on('scroll', (args) => {
        if (args.scroll.y > 100) {
            document.body.dataset.scrollDirection = args.direction;
        }
        else {
            document.body.dataset.scrollDirection = '';
        }
        });
        
        scroll.on('call', func => {
            statsCounter();
        })  
    }, 0)

    // PRIVACY
    
    if (document.querySelector('.privacy')) {
        let containers = document.querySelectorAll('[data-sector]');
        let links = document.querySelectorAll('.privacy_pagination__link');
        let anchorLinks = document.querySelectorAll('[data-anchor-link]');
      
        function intersectionHandler(entries) {
            [].forEach.call(entries, function(entry) {
                let sector = entry.target.dataset.sector;
                let link = [].find.call(links, link =>  link.getAttribute('href').replace('#', '') === sector);
                if (entry.isIntersecting) {
                    link.classList.add('is-active');
                }
                else {
                    link.classList.remove('is-active');
                }
      
            });
        }
      
        let observerSector = new IntersectionObserver(intersectionHandler, {  threshold: .1, rootMargin: '-20% 0% -50%'});
        [].forEach.call(containers, function(entry) {
            observerSector.observe(entry);
        });
      
        [].forEach.call(anchorLinks, function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
      
                const sector = link.getAttribute('href').replace('#', '');
                const pos = document.querySelector(`[data-sector="${sector}"]`).offsetTop;
                window.scrollTo(0, pos);
            });
        });
      
      }
      
    // ANCHOR LINKS

    const anchorLinks = document.querySelectorAll('[data-anchor]');

    anchorLinks.forEach(link => {
        link.addEventListener('click', evt => {
            evt.preventDefault();
            const target = document.querySelector(`[data-scroll-id=${link.dataset.anchor}]`);
            scroll.scrollTo(target);
        });
    });

    // INPUTS

    const inputs = document.querySelectorAll('.input_wrapper__input');


    document.querySelectorAll('[name="phone"]').forEach((el) => {
        new InputPhone(el);
    });

    inputs.forEach(item => {
        new Input(item, validationMessages);
    })

});