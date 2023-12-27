(function () {
  'use strict';

  const runningOnBrowser = typeof window !== "undefined";

  const isBot =
      (runningOnBrowser && !("onscroll" in window)) ||
      (typeof navigator !== "undefined" && /(gle|ing|ro)bot|crawl|spider/i.test(navigator.userAgent));

  const supportsIntersectionObserver = runningOnBrowser && "IntersectionObserver" in window;

  const supportsClassList = runningOnBrowser && "classList" in document.createElement("p");

  const isHiDpi = runningOnBrowser && window.devicePixelRatio > 1;

  const defaultSettings = {
      elements_selector: ".lazy",
      container: isBot || runningOnBrowser ? document : null,
      threshold: 300,
      thresholds: null,
      data_src: "src",
      data_srcset: "srcset",
      data_sizes: "sizes",
      data_bg: "bg",
      data_bg_hidpi: "bg-hidpi",
      data_bg_multi: "bg-multi",
      data_bg_multi_hidpi: "bg-multi-hidpi",
      data_poster: "poster",
      class_applied: "applied",
      class_loading: "loading",
      class_loaded: "loaded",
      class_error: "error",
      class_entered: "entered",
      class_exited: "exited",
      unobserve_completed: true,
      unobserve_entered: false,
      cancel_on_exit: true,
      callback_enter: null,
      callback_exit: null,
      callback_applied: null,
      callback_loading: null,
      callback_loaded: null,
      callback_error: null,
      callback_finish: null,
      callback_cancel: null,
      use_native: false
  };

  const getExtendedSettings = (customSettings) => {
      return Object.assign({}, defaultSettings, customSettings);
  };

  /* Creates instance and notifies it through the window element */
  const createInstance = function(classObj, options) {
      let event;
      const eventString = "LazyLoad::Initialized";
      const instance = new classObj(options);
      try {
          // Works in modern browsers
          event = new CustomEvent(eventString, { detail: { instance } });
      } catch (err) {
          // Works in Internet Explorer (all versions)
          event = document.createEvent("CustomEvent");
          event.initCustomEvent(eventString, false, false, { instance });
      }
      window.dispatchEvent(event);
  };

  /* Auto initialization of one or more instances of lazyload, depending on the 
      options passed in (plain object or an array) */
  const autoInitialize = (classObj, options) => {
      if (!options) {
          return;
      }
      if (!options.length) {
          // Plain object
          createInstance(classObj, options);
      } else {
          // Array of objects
          for (let i = 0, optionsItem; (optionsItem = options[i]); i += 1) {
              createInstance(classObj, optionsItem);
          }
      }
  };

  const SRC = "src";
  const SRCSET = "srcset";
  const SIZES = "sizes";
  const POSTER = "poster";
  const ORIGINALS = "llOriginalAttrs";

  const statusLoading = "loading";
  const statusLoaded = "loaded";
  const statusApplied = "applied";
  const statusEntered = "entered";
  const statusError = "error";
  const statusNative = "native";

  const dataPrefix = "data-";
  const statusDataName = "ll-status";

  const getData = (element, attribute) => {
      return element.getAttribute(dataPrefix + attribute);
  };

  const setData = (element, attribute, value) => {
      var attrName = dataPrefix + attribute;
      if (value === null) {
          element.removeAttribute(attrName);
          return;
      }
      element.setAttribute(attrName, value);
  };

  const getStatus = (element) => getData(element, statusDataName);
  const setStatus = (element, status) => setData(element, statusDataName, status);
  const resetStatus = (element) => setStatus(element, null);

  const hasEmptyStatus = (element) => getStatus(element) === null;
  const hasStatusLoading = (element) => getStatus(element) === statusLoading;
  const hasStatusError = (element) => getStatus(element) === statusError;
  const hasStatusNative = (element) => getStatus(element) === statusNative;

  const statusesAfterLoading = [statusLoading, statusLoaded, statusApplied, statusError];
  const hadStartedLoading = (element) => statusesAfterLoading.indexOf(getStatus(element)) >= 0;

  const safeCallback = (callback, arg1, arg2, arg3) => {
  	if (!callback) {
  		return;
  	}

  	if (arg3 !== undefined) {
  		callback(arg1, arg2, arg3);
  		return;
  	}
  	if (arg2 !== undefined) {
  		callback(arg1, arg2);
  		return;
  	}
  	callback(arg1);
  };

  const addClass = (element, className) => {
  	if (supportsClassList) {
  		element.classList.add(className);
  		return;
  	}
  	element.className += (element.className ? " " : "") + className;
  };

  const removeClass = (element, className) => {
  	if (supportsClassList) {
  		element.classList.remove(className);
  		return;
  	}
  	element.className = element.className.
  		replace(new RegExp("(^|\\s+)" + className + "(\\s+|$)"), " ").
  		replace(/^\s+/, "").
  		replace(/\s+$/, "");
  };

  const addTempImage = (element) => {
      element.llTempImage = document.createElement("IMG");
  };

  const deleteTempImage = (element) => {
      delete element.llTempImage;
  };

  const getTempImage = (element) => element.llTempImage;

  const unobserve = (element, instance) => {
      if (!instance) return;
      const observer = instance._observer;
      if (!observer) return;
      observer.unobserve(element);
  };

  const resetObserver = (observer) => {
      observer.disconnect();
  };

  const unobserveEntered = (element, settings, instance) => {
      if (settings.unobserve_entered) unobserve(element, instance);
  };

  const updateLoadingCount = (instance, delta) => {
      if (!instance) return;
      instance.loadingCount += delta;
  };

  const decreaseToLoadCount = (instance) => {
      if (!instance) return;
      instance.toLoadCount -= 1;
  };

  const setToLoadCount = (instance, value) => {
      if (!instance) return;
      instance.toLoadCount = value;
  };

  const isSomethingLoading = (instance) => instance.loadingCount > 0;

  const haveElementsToLoad = (instance) => instance.toLoadCount > 0;

  const getSourceTags = (parentTag) => {
    let sourceTags = [];
    for (let i = 0, childTag; (childTag = parentTag.children[i]); i += 1) {
        if (childTag.tagName === "SOURCE") {
            sourceTags.push(childTag);
        }
    }
    return sourceTags;
  };

  const forEachPictureSource = (element, fn) => {
    const parent = element.parentNode;
    if (!parent || parent.tagName !== "PICTURE") {
        return;
    }
    let sourceTags = getSourceTags(parent);
    sourceTags.forEach(fn);
  };

  const forEachVideoSource = (element, fn) => {
    let sourceTags = getSourceTags(element);
    sourceTags.forEach(fn);
  };

  const attrsSrc = [SRC];
  const attrsSrcPoster = [SRC, POSTER];
  const attrsSrcSrcsetSizes = [SRC, SRCSET, SIZES];

  const hasOriginalAttrs = (element) => !!element[ORIGINALS];
  const getOriginalAttrs = (element) => element[ORIGINALS];
  const deleteOriginalAttrs = (element) => delete element[ORIGINALS];

  // ## SAVE ##

  const setOriginalsObject = (element, attributes) => {
      if (hasOriginalAttrs(element)) {
          return;
      }
      const originals = {};
      attributes.forEach((attribute) => {
          originals[attribute] = element.getAttribute(attribute);
      });
      element[ORIGINALS] = originals;
  };

  const saveOriginalBackgroundStyle = (element) => {
      if (hasOriginalAttrs(element)) {
          return;
      }
      element[ORIGINALS] = { backgroundImage: element.style.backgroundImage };
  };

  // ## RESTORE ##

  const setOrResetAttribute = (element, attrName, value) => {
      if (!value) {
          element.removeAttribute(attrName);
          return;
      }
      element.setAttribute(attrName, value);
  };

  const restoreOriginalAttrs = (element, attributes) => {
      if (!hasOriginalAttrs(element)) {
          return;
      }
      const originals = getOriginalAttrs(element);
      attributes.forEach((attribute) => {
          setOrResetAttribute(element, attribute, originals[attribute]);
      });
  };

  const restoreOriginalBgImage = (element) => {
      if (!hasOriginalAttrs(element)) {
          return;
      }
      const originals = getOriginalAttrs(element);    
      element.style.backgroundImage = originals.backgroundImage;
  };

  const manageApplied = (element, settings, instance) => {
      addClass(element, settings.class_applied);
      setStatus(element, statusApplied);
      // Instance is not provided when loading is called from static class
      if (!instance) return;
      if (settings.unobserve_completed) {
          // Unobserve now because we can't do it on load
          unobserve(element, settings);
      }
      safeCallback(settings.callback_applied, element, instance);
  };

  const manageLoading = (element, settings, instance) => {
      addClass(element, settings.class_loading);
      setStatus(element, statusLoading);
      // Instance is not provided when loading is called from static class
      if (!instance) return;
      updateLoadingCount(instance, +1);
      safeCallback(settings.callback_loading, element, instance);
  };

  const setAttributeIfValue = (element, attrName, value) => {
      if (!value) {
          return;
      }
      element.setAttribute(attrName, value);
  };

  const setImageAttributes = (element, settings) => {
      setAttributeIfValue(element, SIZES, getData(element, settings.data_sizes));
      setAttributeIfValue(element, SRCSET, getData(element, settings.data_srcset));
      setAttributeIfValue(element, SRC, getData(element, settings.data_src));
  };

  const setSourcesImg = (imgEl, settings) => {
      forEachPictureSource(imgEl, (sourceTag) => {
          setOriginalsObject(sourceTag, attrsSrcSrcsetSizes);
          setImageAttributes(sourceTag, settings);
      });
      setOriginalsObject(imgEl, attrsSrcSrcsetSizes);
      setImageAttributes(imgEl, settings);
  };

  const setSourcesIframe = (iframe, settings) => {
      setOriginalsObject(iframe, attrsSrc);
      setAttributeIfValue(iframe, SRC, getData(iframe, settings.data_src));
  };

  const setSourcesVideo = (videoEl, settings) => {
      forEachVideoSource(videoEl, (sourceEl) => {
          setOriginalsObject(sourceEl, attrsSrc);
          setAttributeIfValue(sourceEl, SRC, getData(sourceEl, settings.data_src));
      });
      setOriginalsObject(videoEl, attrsSrcPoster);

      setAttributeIfValue(videoEl, POSTER, getData(videoEl, settings.data_poster));
      setAttributeIfValue(videoEl, SRC, getData(videoEl, settings.data_src));
      videoEl.load();
  };

  const setBackground = (element, settings, instance) => {
      const bg1xValue = getData(element, settings.data_bg);
      const bgHiDpiValue = getData(element, settings.data_bg_hidpi);
      const bgDataValue = isHiDpi && bgHiDpiValue ? bgHiDpiValue : bg1xValue;
      if (!bgDataValue) return;
      element.style.backgroundImage = `url("${bgDataValue}")`;
      getTempImage(element).setAttribute(SRC, bgDataValue);
      manageLoading(element, settings, instance);
  };

  // NOTE: THE TEMP IMAGE TRICK CANNOT BE DONE WITH data-multi-bg
  // BECAUSE INSIDE ITS VALUES MUST BE WRAPPED WITH URL() AND ONE OF THEM
  // COULD BE A GRADIENT BACKGROUND IMAGE
  const setMultiBackground = (element, settings, instance) => {
      const bg1xValue = getData(element, settings.data_bg_multi);
      const bgHiDpiValue = getData(element, settings.data_bg_multi_hidpi);
      const bgDataValue = isHiDpi && bgHiDpiValue ? bgHiDpiValue : bg1xValue;
      if (!bgDataValue) {
          return;
      }
      element.style.backgroundImage = bgDataValue;
      manageApplied(element, settings, instance);
  };

  const setSourcesFunctions = {
      IMG: setSourcesImg,
      IFRAME: setSourcesIframe,
      VIDEO: setSourcesVideo
  };

  const setSourcesNative = (element, settings) => {
      const setSourcesFunction = setSourcesFunctions[element.tagName];
      if (!setSourcesFunction) {
          return;
      }
      setSourcesFunction(element, settings);
  };

  const setSources = (element, settings, instance) => {
      const setSourcesFunction = setSourcesFunctions[element.tagName];
      if (!setSourcesFunction) {
          return;
      }
      setSourcesFunction(element, settings);
      manageLoading(element, settings, instance);
  };

  const elementsWithLoadEvent = ["IMG", "IFRAME", "VIDEO"];
  const hasLoadEvent = (element) => elementsWithLoadEvent.indexOf(element.tagName) > -1;

  const checkFinish = (settings, instance) => {
      if (instance && !isSomethingLoading(instance) && !haveElementsToLoad(instance)) {
          safeCallback(settings.callback_finish, instance);
      }
  };

  const addEventListener = (element, eventName, handler) => {
      element.addEventListener(eventName, handler);
      element.llEvLisnrs[eventName] = handler;
  };

  const removeEventListener = (element, eventName, handler) => {
      element.removeEventListener(eventName, handler);
  };

  const hasEventListeners = (element) => {
      return !!element.llEvLisnrs;
  };

  const addEventListeners = (element, loadHandler, errorHandler) => {
      if (!hasEventListeners(element)) element.llEvLisnrs = {};
      const loadEventName = element.tagName === "VIDEO" ? "loadeddata" : "load";
      addEventListener(element, loadEventName, loadHandler);
      addEventListener(element, "error", errorHandler);
  };

  const removeEventListeners = (element) => {
      if (!hasEventListeners(element)) {
          return;
      }
      const eventListeners = element.llEvLisnrs;
      for (let eventName in eventListeners) {
          const handler = eventListeners[eventName];
          removeEventListener(element, eventName, handler);
      }
      delete element.llEvLisnrs;
  };

  const doneHandler = (element, settings, instance) => {
      deleteTempImage(element);
      updateLoadingCount(instance, -1);
      decreaseToLoadCount(instance);
      removeClass(element, settings.class_loading);
      if (settings.unobserve_completed) {
          unobserve(element, instance);
      }
  };

  const loadHandler = (event, element, settings, instance) => {
      const goingNative = hasStatusNative(element);
      doneHandler(element, settings, instance);
      addClass(element, settings.class_loaded);
      setStatus(element, statusLoaded);
      safeCallback(settings.callback_loaded, element, instance);
      if (!goingNative) checkFinish(settings, instance);
  };

  const errorHandler = (event, element, settings, instance) => {
      const goingNative = hasStatusNative(element);
      doneHandler(element, settings, instance);
      addClass(element, settings.class_error);
      setStatus(element, statusError);
      safeCallback(settings.callback_error, element, instance);
      if (!goingNative) checkFinish(settings, instance);
  };

  const addOneShotEventListeners = (element, settings, instance) => {
      const elementToListenTo = getTempImage(element) || element;
      if (hasEventListeners(elementToListenTo)) {
          // This happens when loading is retried twice
          return;
      }
      const _loadHandler = (event) => {
          loadHandler(event, element, settings, instance);
          removeEventListeners(elementToListenTo);
      };
      const _errorHandler = (event) => {
          errorHandler(event, element, settings, instance);
          removeEventListeners(elementToListenTo);
      };
      addEventListeners(elementToListenTo, _loadHandler, _errorHandler);
  };

  const loadBackground = (element, settings, instance) => {
      addTempImage(element);
      addOneShotEventListeners(element, settings, instance);
      saveOriginalBackgroundStyle(element);
      setBackground(element, settings, instance);
      setMultiBackground(element, settings, instance);
  };

  const loadRegular = (element, settings, instance) => {
      addOneShotEventListeners(element, settings, instance);
      setSources(element, settings, instance);
  };

  const load = (element, settings, instance) => {
      if (hasLoadEvent(element)) {
          loadRegular(element, settings, instance);
      } else {
          loadBackground(element, settings, instance);
      }
  };

  const loadNative = (element, settings, instance) => {
      element.setAttribute("loading", "lazy");
      addOneShotEventListeners(element, settings, instance);
      setSourcesNative(element, settings);
      setStatus(element, statusNative);
  };

  const removeImageAttributes = (element) => {
      element.removeAttribute(SRC);
      element.removeAttribute(SRCSET);
      element.removeAttribute(SIZES);
  };

  const resetSourcesImg = (element) => {
      forEachPictureSource(element, (sourceTag) => {
          removeImageAttributes(sourceTag);
      });
      removeImageAttributes(element);
  };

  const restoreImg = (imgEl) => {
      forEachPictureSource(imgEl, (sourceEl) => {
          restoreOriginalAttrs(sourceEl, attrsSrcSrcsetSizes);
      });
      restoreOriginalAttrs(imgEl, attrsSrcSrcsetSizes);
  };

  const restoreVideo = (videoEl) => {
      forEachVideoSource(videoEl, (sourceEl) => {
          restoreOriginalAttrs(sourceEl, attrsSrc);
      });
      restoreOriginalAttrs(videoEl, attrsSrcPoster);
      videoEl.load();
  };

  const restoreIframe = (iframeEl) => {
      restoreOriginalAttrs(iframeEl, attrsSrc);
  };

  const restoreFunctions = {
      IMG: restoreImg,
      IFRAME: restoreIframe,
      VIDEO: restoreVideo
  };

  const restoreAttributes = (element) => {
      const restoreFunction = restoreFunctions[element.tagName];
      if (!restoreFunction) {
          restoreOriginalBgImage(element);
          return;
      }
      restoreFunction(element);
  };

  const resetClasses = (element, settings) => {
      if (hasEmptyStatus(element) || hasStatusNative(element)) {
          return;
      }
      removeClass(element, settings.class_entered);
      removeClass(element, settings.class_exited);
      removeClass(element, settings.class_applied);
      removeClass(element, settings.class_loading);
      removeClass(element, settings.class_loaded);
      removeClass(element, settings.class_error);
  };

  const restore = (element, settings) => {
      restoreAttributes(element);
      resetClasses(element, settings);
      resetStatus(element);
      deleteOriginalAttrs(element);
  };

  const cancelLoading = (element, entry, settings, instance) => {
      if (!settings.cancel_on_exit) return;
      if (!hasStatusLoading(element)) return;
      if (element.tagName !== "IMG") return; //Works only on images
      removeEventListeners(element);
      resetSourcesImg(element);
      restoreImg(element);
      removeClass(element, settings.class_loading);
      updateLoadingCount(instance, -1);
      resetStatus(element);
      safeCallback(settings.callback_cancel, element, entry, instance);
  };

  const onEnter = (element, entry, settings, instance) => {
      const dontLoad = hadStartedLoading(element); /* Save status 
          before setting it, to prevent loading it again. Fixes #526. */
      setStatus(element, statusEntered);
      addClass(element, settings.class_entered);
      removeClass(element, settings.class_exited);
      unobserveEntered(element, settings, instance);
      safeCallback(settings.callback_enter, element, entry, instance);
      if (dontLoad) return;
      load(element, settings, instance);
  };

  const onExit = (element, entry, settings, instance) => {
      if (hasEmptyStatus(element)) return; //Ignore the first pass, at landing
      addClass(element, settings.class_exited);
      cancelLoading(element, entry, settings, instance);
      safeCallback(settings.callback_exit, element, entry, instance);
  };

  const tagsWithNativeLazy = ["IMG", "IFRAME", "VIDEO"];

  const shouldUseNative = (settings) =>
      settings.use_native && "loading" in HTMLImageElement.prototype;

  const loadAllNative = (elements, settings, instance) => {
      elements.forEach((element) => {
          if (tagsWithNativeLazy.indexOf(element.tagName) === -1) {
              return;
          }
          loadNative(element, settings, instance);
      });
      setToLoadCount(instance, 0);
  };

  const isIntersecting = (entry) => entry.isIntersecting || entry.intersectionRatio > 0;

  const getObserverSettings = (settings) => ({
      root: settings.container === document ? null : settings.container,
      rootMargin: settings.thresholds || settings.threshold + "px"
  });

  const intersectionHandler = (entries, settings, instance) => {
      entries.forEach((entry) =>
          isIntersecting(entry)
              ? onEnter(entry.target, entry, settings, instance)
              : onExit(entry.target, entry, settings, instance)
      );
  };

  const observeElements = (observer, elements) => {
      elements.forEach((element) => {
          observer.observe(element);
      });
  };

  const updateObserver = (observer, elementsToObserve) => {
      resetObserver(observer);
      observeElements(observer, elementsToObserve);
  };

  const setObserver = (settings, instance) => {
      if (!supportsIntersectionObserver || shouldUseNative(settings)) {
          return;
      }
      instance._observer = new IntersectionObserver((entries) => {
          intersectionHandler(entries, settings, instance);
      }, getObserverSettings(settings));
  };

  const toArray = (nodeSet) => Array.prototype.slice.call(nodeSet);

  const queryElements = (settings) =>
      settings.container.querySelectorAll(settings.elements_selector);

  const excludeManagedElements = (elements) => toArray(elements).filter(hasEmptyStatus);

  const hasError = (element) => hasStatusError(element);
  const filterErrorElements = (elements) => toArray(elements).filter(hasError);

  const getElementsToLoad = (elements, settings) =>
      excludeManagedElements(elements || queryElements(settings));

  const retryLazyLoad = (settings, instance) => {
      const errorElements = filterErrorElements(queryElements(settings));
      errorElements.forEach(element => {
          removeClass(element, settings.class_error);
          resetStatus(element);
      });
      instance.update();
  };

  const setOnlineCheck = (settings, instance) => {
      if (!runningOnBrowser) {
          return;
      }
      window.addEventListener("online", () => {
          retryLazyLoad(settings, instance);
      });
  };

  const LazyLoad = function (customSettings, elements) {
      const settings = getExtendedSettings(customSettings);
      this._settings = settings;
      this.loadingCount = 0;
      setObserver(settings, this);
      setOnlineCheck(settings, this);
      this.update(elements);
  };

  LazyLoad.prototype = {
      update: function (givenNodeset) {
          const settings = this._settings;
          const elementsToLoad = getElementsToLoad(givenNodeset, settings);
          setToLoadCount(this, elementsToLoad.length);

          if (isBot || !supportsIntersectionObserver) {
              this.loadAll(elementsToLoad);
              return;
          }
          if (shouldUseNative(settings)) {
              loadAllNative(elementsToLoad, settings, this);
              return;
          }

          updateObserver(this._observer, elementsToLoad);
      },

      destroy: function () {
          // Observer
          if (this._observer) {
              this._observer.disconnect();
          }
          // Clean custom attributes on elements
          queryElements(this._settings).forEach((element) => {
              deleteOriginalAttrs(element);
          });
          // Delete all internal props
          delete this._observer;
          delete this._settings;
          delete this.loadingCount;
          delete this.toLoadCount;
      },

      loadAll: function (elements) {
          const settings = this._settings;
          const elementsToLoad = getElementsToLoad(elements, settings);
          elementsToLoad.forEach((element) => {
              unobserve(element, this);
              load(element, settings, this);
          });
      },

      restoreAll: function() {
          const settings = this._settings;
          queryElements(settings).forEach((element) => {
              restore(element, settings);
          });
      }
  };

  LazyLoad.load = (element, customSettings) => {
      const settings = getExtendedSettings(customSettings);
      load(element, settings);
  };

  LazyLoad.resetStatus = (element) => {
      resetStatus(element);
  };

  // Automatic instances creation if required (useful for async script loading)
  if (runningOnBrowser) {
      autoInitialize(LazyLoad, window.lazyLoadOptions);
  }

  /* locomotive-scroll v4.1.2 | MIT License | https://github.com/locomotivemtl/locomotive-scroll */
  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      if (enumerableOnly) symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};

      if (i % 2) {
        ownKeys(Object(source), true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function");
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        writable: true,
        configurable: true
      }
    });
    if (superClass) _setPrototypeOf(subClass, superClass);
  }

  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
      return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _getPrototypeOf(o);
  }

  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };

    return _setPrototypeOf(o, p);
  }

  function _isNativeReflectConstruct() {
    if (typeof Reflect === "undefined" || !Reflect.construct) return false;
    if (Reflect.construct.sham) return false;
    if (typeof Proxy === "function") return true;

    try {
      Date.prototype.toString.call(Reflect.construct(Date, [], function () {}));
      return true;
    } catch (e) {
      return false;
    }
  }

  function _assertThisInitialized(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return self;
  }

  function _possibleConstructorReturn(self, call) {
    if (call && (typeof call === "object" || typeof call === "function")) {
      return call;
    }

    return _assertThisInitialized(self);
  }

  function _createSuper(Derived) {
    var hasNativeReflectConstruct = _isNativeReflectConstruct();

    return function _createSuperInternal() {
      var Super = _getPrototypeOf(Derived),
          result;

      if (hasNativeReflectConstruct) {
        var NewTarget = _getPrototypeOf(this).constructor;

        result = Reflect.construct(Super, arguments, NewTarget);
      } else {
        result = Super.apply(this, arguments);
      }

      return _possibleConstructorReturn(this, result);
    };
  }

  function _superPropBase(object, property) {
    while (!Object.prototype.hasOwnProperty.call(object, property)) {
      object = _getPrototypeOf(object);
      if (object === null) break;
    }

    return object;
  }

  function _get(target, property, receiver) {
    if (typeof Reflect !== "undefined" && Reflect.get) {
      _get = Reflect.get;
    } else {
      _get = function _get(target, property, receiver) {
        var base = _superPropBase(target, property);

        if (!base) return;
        var desc = Object.getOwnPropertyDescriptor(base, property);

        if (desc.get) {
          return desc.get.call(receiver);
        }

        return desc.value;
      };
    }

    return _get(target, property, receiver || target);
  }

  function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
  }

  function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
  }

  function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
  }

  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
  }

  function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
  }

  function _iterableToArrayLimit(arr, i) {
    if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
  }

  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;

    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

    return arr2;
  }

  function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  var defaults = {
    el: document,
    name: 'scroll',
    offset: [0, 0],
    repeat: false,
    smooth: false,
    initPosition: {
      x: 0,
      y: 0
    },
    direction: 'vertical',
    gestureDirection: 'vertical',
    reloadOnContextChange: false,
    lerp: 0.1,
    "class": 'is-inview',
    scrollbarContainer: false,
    scrollbarClass: 'c-scrollbar',
    scrollingClass: 'has-scroll-scrolling',
    draggingClass: 'has-scroll-dragging',
    smoothClass: 'has-scroll-smooth',
    initClass: 'has-scroll-init',
    getSpeed: false,
    getDirection: false,
    scrollFromAnywhere: false,
    multiplier: 1,
    firefoxMultiplier: 50,
    touchMultiplier: 2,
    resetNativeScroll: true,
    tablet: {
      smooth: false,
      direction: 'vertical',
      gestureDirection: 'vertical',
      breakpoint: 1024
    },
    smartphone: {
      smooth: false,
      direction: 'vertical',
      gestureDirection: 'vertical'
    }
  };

  var _default = /*#__PURE__*/function () {
    function _default() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, _default);

      Object.assign(this, defaults, options);
      this.smartphone = defaults.smartphone;
      if (options.smartphone) Object.assign(this.smartphone, options.smartphone);
      this.tablet = defaults.tablet;
      if (options.tablet) Object.assign(this.tablet, options.tablet);
      this.namespace = 'locomotive';
      this.html = document.documentElement;
      this.windowHeight = window.innerHeight;
      this.windowWidth = window.innerWidth;
      this.windowMiddle = {
        x: this.windowWidth / 2,
        y: this.windowHeight / 2
      };
      this.els = {};
      this.currentElements = {};
      this.listeners = {};
      this.hasScrollTicking = false;
      this.hasCallEventSet = false;
      this.checkScroll = this.checkScroll.bind(this);
      this.checkResize = this.checkResize.bind(this);
      this.checkEvent = this.checkEvent.bind(this);
      this.instance = {
        scroll: {
          x: 0,
          y: 0
        },
        limit: {
          x: this.html.offsetWidth,
          y: this.html.offsetHeight
        },
        currentElements: this.currentElements
      };

      if (this.isMobile) {
        if (this.isTablet) {
          this.context = 'tablet';
        } else {
          this.context = 'smartphone';
        }
      } else {
        this.context = 'desktop';
      }

      if (this.isMobile) this.direction = this[this.context].direction;

      if (this.direction === 'horizontal') {
        this.directionAxis = 'x';
      } else {
        this.directionAxis = 'y';
      }

      if (this.getDirection) {
        this.instance.direction = null;
      }

      if (this.getDirection) {
        this.instance.speed = 0;
      }

      this.html.classList.add(this.initClass);
      window.addEventListener('resize', this.checkResize, false);
    }

    _createClass(_default, [{
      key: "init",
      value: function init() {
        this.initEvents();
      }
    }, {
      key: "checkScroll",
      value: function checkScroll() {
        this.dispatchScroll();
      }
    }, {
      key: "checkResize",
      value: function checkResize() {
        var _this = this;

        if (!this.resizeTick) {
          this.resizeTick = true;
          requestAnimationFrame(function () {
            _this.resize();

            _this.resizeTick = false;
          });
        }
      }
    }, {
      key: "resize",
      value: function resize() {}
    }, {
      key: "checkContext",
      value: function checkContext() {
        if (!this.reloadOnContextChange) return;
        this.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 || this.windowWidth < this.tablet.breakpoint;
        this.isTablet = this.isMobile && this.windowWidth >= this.tablet.breakpoint;
        var oldContext = this.context;

        if (this.isMobile) {
          if (this.isTablet) {
            this.context = 'tablet';
          } else {
            this.context = 'smartphone';
          }
        } else {
          this.context = 'desktop';
        }

        if (oldContext != this.context) {
          var oldSmooth = oldContext == 'desktop' ? this.smooth : this[oldContext].smooth;
          var newSmooth = this.context == 'desktop' ? this.smooth : this[this.context].smooth;
          if (oldSmooth != newSmooth) window.location.reload();
        }
      }
    }, {
      key: "initEvents",
      value: function initEvents() {
        var _this2 = this;

        this.scrollToEls = this.el.querySelectorAll("[data-".concat(this.name, "-to]"));
        this.setScrollTo = this.setScrollTo.bind(this);
        this.scrollToEls.forEach(function (el) {
          el.addEventListener('click', _this2.setScrollTo, false);
        });
      }
    }, {
      key: "setScrollTo",
      value: function setScrollTo(event) {
        event.preventDefault();
        this.scrollTo(event.currentTarget.getAttribute("data-".concat(this.name, "-href")) || event.currentTarget.getAttribute('href'), {
          offset: event.currentTarget.getAttribute("data-".concat(this.name, "-offset"))
        });
      }
    }, {
      key: "addElements",
      value: function addElements() {}
    }, {
      key: "detectElements",
      value: function detectElements(hasCallEventSet) {
        var _this3 = this;

        var scrollTop = this.instance.scroll.y;
        var scrollBottom = scrollTop + this.windowHeight;
        var scrollLeft = this.instance.scroll.x;
        var scrollRight = scrollLeft + this.windowWidth;
        Object.entries(this.els).forEach(function (_ref) {
          var _ref2 = _slicedToArray(_ref, 2),
              i = _ref2[0],
              el = _ref2[1];

          if (el && (!el.inView || hasCallEventSet)) {
            if (_this3.direction === 'horizontal') {
              if (scrollRight >= el.left && scrollLeft < el.right) {
                _this3.setInView(el, i);
              }
            } else {
              if (scrollBottom >= el.top && scrollTop < el.bottom) {
                _this3.setInView(el, i);
              }
            }
          }

          if (el && el.inView) {
            if (_this3.direction === 'horizontal') {
              var width = el.right - el.left;
              el.progress = (_this3.instance.scroll.x - (el.left - _this3.windowWidth)) / (width + _this3.windowWidth);

              if (scrollRight < el.left || scrollLeft > el.right) {
                _this3.setOutOfView(el, i);
              }
            } else {
              var height = el.bottom - el.top;
              el.progress = (_this3.instance.scroll.y - (el.top - _this3.windowHeight)) / (height + _this3.windowHeight);

              if (scrollBottom < el.top || scrollTop > el.bottom) {
                _this3.setOutOfView(el, i);
              }
            }
          }
        }); // this.els = this.els.filter((current, i) => {
        //     return current !== null;
        // });

        this.hasScrollTicking = false;
      }
    }, {
      key: "setInView",
      value: function setInView(current, i) {
        this.els[i].inView = true;
        current.el.classList.add(current["class"]);
        this.currentElements[i] = current;

        if (current.call && this.hasCallEventSet) {
          this.dispatchCall(current, 'enter');

          if (!current.repeat) {
            this.els[i].call = false;
          }
        } // if (!current.repeat && !current.speed && !current.sticky) {
        //     if (!current.call || current.call && this.hasCallEventSet) {
        //        this.els[i] = null
        //     }
        // }

      }
    }, {
      key: "setOutOfView",
      value: function setOutOfView(current, i) {
        var _this4 = this;

        // if (current.repeat || current.speed !== undefined) {
        this.els[i].inView = false; // }

        Object.keys(this.currentElements).forEach(function (el) {
          el === i && delete _this4.currentElements[el];
        });

        if (current.call && this.hasCallEventSet) {
          this.dispatchCall(current, 'exit');
        }

        if (current.repeat) {
          current.el.classList.remove(current["class"]);
        }
      }
    }, {
      key: "dispatchCall",
      value: function dispatchCall(current, way) {
        this.callWay = way;
        this.callValue = current.call.split(',').map(function (item) {
          return item.trim();
        });
        this.callObj = current;
        if (this.callValue.length == 1) this.callValue = this.callValue[0];
        var callEvent = new Event(this.namespace + 'call');
        this.el.dispatchEvent(callEvent);
      }
    }, {
      key: "dispatchScroll",
      value: function dispatchScroll() {
        var scrollEvent = new Event(this.namespace + 'scroll');
        this.el.dispatchEvent(scrollEvent);
      }
    }, {
      key: "setEvents",
      value: function setEvents(event, func) {
        if (!this.listeners[event]) {
          this.listeners[event] = [];
        }

        var list = this.listeners[event];
        list.push(func);

        if (list.length === 1) {
          this.el.addEventListener(this.namespace + event, this.checkEvent, false);
        }

        if (event === 'call') {
          this.hasCallEventSet = true;
          this.detectElements(true);
        }
      }
    }, {
      key: "unsetEvents",
      value: function unsetEvents(event, func) {
        if (!this.listeners[event]) return;
        var list = this.listeners[event];
        var index = list.indexOf(func);
        if (index < 0) return;
        list.splice(index, 1);

        if (list.index === 0) {
          this.el.removeEventListener(this.namespace + event, this.checkEvent, false);
        }
      }
    }, {
      key: "checkEvent",
      value: function checkEvent(event) {
        var _this5 = this;

        var name = event.type.replace(this.namespace, '');
        var list = this.listeners[name];
        if (!list || list.length === 0) return;
        list.forEach(function (func) {
          switch (name) {
            case 'scroll':
              return func(_this5.instance);

            case 'call':
              return func(_this5.callValue, _this5.callWay, _this5.callObj);

            default:
              return func();
          }
        });
      }
    }, {
      key: "startScroll",
      value: function startScroll() {}
    }, {
      key: "stopScroll",
      value: function stopScroll() {}
    }, {
      key: "setScroll",
      value: function setScroll(x, y) {
        this.instance.scroll = {
          x: 0,
          y: 0
        };
      }
    }, {
      key: "destroy",
      value: function destroy() {
        var _this6 = this;

        window.removeEventListener('resize', this.checkResize, false);
        Object.keys(this.listeners).forEach(function (event) {
          _this6.el.removeEventListener(_this6.namespace + event, _this6.checkEvent, false);
        });
        this.listeners = {};
        this.scrollToEls.forEach(function (el) {
          el.removeEventListener('click', _this6.setScrollTo, false);
        });
        this.html.classList.remove(this.initClass);
      }
    }]);

    return _default;
  }();

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var smoothscroll = createCommonjsModule(function (module, exports) {
  /* smoothscroll v0.4.4 - 2019 - Dustan Kasten, Jeremias Menichelli - MIT License */
  (function () {

    // polyfill
    function polyfill() {
      // aliases
      var w = window;
      var d = document;

      // return if scroll behavior is supported and polyfill is not forced
      if (
        'scrollBehavior' in d.documentElement.style &&
        w.__forceSmoothScrollPolyfill__ !== true
      ) {
        return;
      }

      // globals
      var Element = w.HTMLElement || w.Element;
      var SCROLL_TIME = 468;

      // object gathering original scroll methods
      var original = {
        scroll: w.scroll || w.scrollTo,
        scrollBy: w.scrollBy,
        elementScroll: Element.prototype.scroll || scrollElement,
        scrollIntoView: Element.prototype.scrollIntoView
      };

      // define timing method
      var now =
        w.performance && w.performance.now
          ? w.performance.now.bind(w.performance)
          : Date.now;

      /**
       * indicates if a the current browser is made by Microsoft
       * @method isMicrosoftBrowser
       * @param {String} userAgent
       * @returns {Boolean}
       */
      function isMicrosoftBrowser(userAgent) {
        var userAgentPatterns = ['MSIE ', 'Trident/', 'Edge/'];

        return new RegExp(userAgentPatterns.join('|')).test(userAgent);
      }

      /*
       * IE has rounding bug rounding down clientHeight and clientWidth and
       * rounding up scrollHeight and scrollWidth causing false positives
       * on hasScrollableSpace
       */
      var ROUNDING_TOLERANCE = isMicrosoftBrowser(w.navigator.userAgent) ? 1 : 0;

      /**
       * changes scroll position inside an element
       * @method scrollElement
       * @param {Number} x
       * @param {Number} y
       * @returns {undefined}
       */
      function scrollElement(x, y) {
        this.scrollLeft = x;
        this.scrollTop = y;
      }

      /**
       * returns result of applying ease math function to a number
       * @method ease
       * @param {Number} k
       * @returns {Number}
       */
      function ease(k) {
        return 0.5 * (1 - Math.cos(Math.PI * k));
      }

      /**
       * indicates if a smooth behavior should be applied
       * @method shouldBailOut
       * @param {Number|Object} firstArg
       * @returns {Boolean}
       */
      function shouldBailOut(firstArg) {
        if (
          firstArg === null ||
          typeof firstArg !== 'object' ||
          firstArg.behavior === undefined ||
          firstArg.behavior === 'auto' ||
          firstArg.behavior === 'instant'
        ) {
          // first argument is not an object/null
          // or behavior is auto, instant or undefined
          return true;
        }

        if (typeof firstArg === 'object' && firstArg.behavior === 'smooth') {
          // first argument is an object and behavior is smooth
          return false;
        }

        // throw error when behavior is not supported
        throw new TypeError(
          'behavior member of ScrollOptions ' +
            firstArg.behavior +
            ' is not a valid value for enumeration ScrollBehavior.'
        );
      }

      /**
       * indicates if an element has scrollable space in the provided axis
       * @method hasScrollableSpace
       * @param {Node} el
       * @param {String} axis
       * @returns {Boolean}
       */
      function hasScrollableSpace(el, axis) {
        if (axis === 'Y') {
          return el.clientHeight + ROUNDING_TOLERANCE < el.scrollHeight;
        }

        if (axis === 'X') {
          return el.clientWidth + ROUNDING_TOLERANCE < el.scrollWidth;
        }
      }

      /**
       * indicates if an element has a scrollable overflow property in the axis
       * @method canOverflow
       * @param {Node} el
       * @param {String} axis
       * @returns {Boolean}
       */
      function canOverflow(el, axis) {
        var overflowValue = w.getComputedStyle(el, null)['overflow' + axis];

        return overflowValue === 'auto' || overflowValue === 'scroll';
      }

      /**
       * indicates if an element can be scrolled in either axis
       * @method isScrollable
       * @param {Node} el
       * @param {String} axis
       * @returns {Boolean}
       */
      function isScrollable(el) {
        var isScrollableY = hasScrollableSpace(el, 'Y') && canOverflow(el, 'Y');
        var isScrollableX = hasScrollableSpace(el, 'X') && canOverflow(el, 'X');

        return isScrollableY || isScrollableX;
      }

      /**
       * finds scrollable parent of an element
       * @method findScrollableParent
       * @param {Node} el
       * @returns {Node} el
       */
      function findScrollableParent(el) {
        while (el !== d.body && isScrollable(el) === false) {
          el = el.parentNode || el.host;
        }

        return el;
      }

      /**
       * self invoked function that, given a context, steps through scrolling
       * @method step
       * @param {Object} context
       * @returns {undefined}
       */
      function step(context) {
        var time = now();
        var value;
        var currentX;
        var currentY;
        var elapsed = (time - context.startTime) / SCROLL_TIME;

        // avoid elapsed times higher than one
        elapsed = elapsed > 1 ? 1 : elapsed;

        // apply easing to elapsed time
        value = ease(elapsed);

        currentX = context.startX + (context.x - context.startX) * value;
        currentY = context.startY + (context.y - context.startY) * value;

        context.method.call(context.scrollable, currentX, currentY);

        // scroll more if we have not reached our destination
        if (currentX !== context.x || currentY !== context.y) {
          w.requestAnimationFrame(step.bind(w, context));
        }
      }

      /**
       * scrolls window or element with a smooth behavior
       * @method smoothScroll
       * @param {Object|Node} el
       * @param {Number} x
       * @param {Number} y
       * @returns {undefined}
       */
      function smoothScroll(el, x, y) {
        var scrollable;
        var startX;
        var startY;
        var method;
        var startTime = now();

        // define scroll context
        if (el === d.body) {
          scrollable = w;
          startX = w.scrollX || w.pageXOffset;
          startY = w.scrollY || w.pageYOffset;
          method = original.scroll;
        } else {
          scrollable = el;
          startX = el.scrollLeft;
          startY = el.scrollTop;
          method = scrollElement;
        }

        // scroll looping over a frame
        step({
          scrollable: scrollable,
          method: method,
          startTime: startTime,
          startX: startX,
          startY: startY,
          x: x,
          y: y
        });
      }

      // ORIGINAL METHODS OVERRIDES
      // w.scroll and w.scrollTo
      w.scroll = w.scrollTo = function() {
        // avoid action when no arguments are passed
        if (arguments[0] === undefined) {
          return;
        }

        // avoid smooth behavior if not required
        if (shouldBailOut(arguments[0]) === true) {
          original.scroll.call(
            w,
            arguments[0].left !== undefined
              ? arguments[0].left
              : typeof arguments[0] !== 'object'
                ? arguments[0]
                : w.scrollX || w.pageXOffset,
            // use top prop, second argument if present or fallback to scrollY
            arguments[0].top !== undefined
              ? arguments[0].top
              : arguments[1] !== undefined
                ? arguments[1]
                : w.scrollY || w.pageYOffset
          );

          return;
        }

        // LET THE SMOOTHNESS BEGIN!
        smoothScroll.call(
          w,
          d.body,
          arguments[0].left !== undefined
            ? ~~arguments[0].left
            : w.scrollX || w.pageXOffset,
          arguments[0].top !== undefined
            ? ~~arguments[0].top
            : w.scrollY || w.pageYOffset
        );
      };

      // w.scrollBy
      w.scrollBy = function() {
        // avoid action when no arguments are passed
        if (arguments[0] === undefined) {
          return;
        }

        // avoid smooth behavior if not required
        if (shouldBailOut(arguments[0])) {
          original.scrollBy.call(
            w,
            arguments[0].left !== undefined
              ? arguments[0].left
              : typeof arguments[0] !== 'object' ? arguments[0] : 0,
            arguments[0].top !== undefined
              ? arguments[0].top
              : arguments[1] !== undefined ? arguments[1] : 0
          );

          return;
        }

        // LET THE SMOOTHNESS BEGIN!
        smoothScroll.call(
          w,
          d.body,
          ~~arguments[0].left + (w.scrollX || w.pageXOffset),
          ~~arguments[0].top + (w.scrollY || w.pageYOffset)
        );
      };

      // Element.prototype.scroll and Element.prototype.scrollTo
      Element.prototype.scroll = Element.prototype.scrollTo = function() {
        // avoid action when no arguments are passed
        if (arguments[0] === undefined) {
          return;
        }

        // avoid smooth behavior if not required
        if (shouldBailOut(arguments[0]) === true) {
          // if one number is passed, throw error to match Firefox implementation
          if (typeof arguments[0] === 'number' && arguments[1] === undefined) {
            throw new SyntaxError('Value could not be converted');
          }

          original.elementScroll.call(
            this,
            // use left prop, first number argument or fallback to scrollLeft
            arguments[0].left !== undefined
              ? ~~arguments[0].left
              : typeof arguments[0] !== 'object' ? ~~arguments[0] : this.scrollLeft,
            // use top prop, second argument or fallback to scrollTop
            arguments[0].top !== undefined
              ? ~~arguments[0].top
              : arguments[1] !== undefined ? ~~arguments[1] : this.scrollTop
          );

          return;
        }

        var left = arguments[0].left;
        var top = arguments[0].top;

        // LET THE SMOOTHNESS BEGIN!
        smoothScroll.call(
          this,
          this,
          typeof left === 'undefined' ? this.scrollLeft : ~~left,
          typeof top === 'undefined' ? this.scrollTop : ~~top
        );
      };

      // Element.prototype.scrollBy
      Element.prototype.scrollBy = function() {
        // avoid action when no arguments are passed
        if (arguments[0] === undefined) {
          return;
        }

        // avoid smooth behavior if not required
        if (shouldBailOut(arguments[0]) === true) {
          original.elementScroll.call(
            this,
            arguments[0].left !== undefined
              ? ~~arguments[0].left + this.scrollLeft
              : ~~arguments[0] + this.scrollLeft,
            arguments[0].top !== undefined
              ? ~~arguments[0].top + this.scrollTop
              : ~~arguments[1] + this.scrollTop
          );

          return;
        }

        this.scroll({
          left: ~~arguments[0].left + this.scrollLeft,
          top: ~~arguments[0].top + this.scrollTop,
          behavior: arguments[0].behavior
        });
      };

      // Element.prototype.scrollIntoView
      Element.prototype.scrollIntoView = function() {
        // avoid smooth behavior if not required
        if (shouldBailOut(arguments[0]) === true) {
          original.scrollIntoView.call(
            this,
            arguments[0] === undefined ? true : arguments[0]
          );

          return;
        }

        // LET THE SMOOTHNESS BEGIN!
        var scrollableParent = findScrollableParent(this);
        var parentRects = scrollableParent.getBoundingClientRect();
        var clientRects = this.getBoundingClientRect();

        if (scrollableParent !== d.body) {
          // reveal element inside parent
          smoothScroll.call(
            this,
            scrollableParent,
            scrollableParent.scrollLeft + clientRects.left - parentRects.left,
            scrollableParent.scrollTop + clientRects.top - parentRects.top
          );

          // reveal parent in viewport unless is fixed
          if (w.getComputedStyle(scrollableParent).position !== 'fixed') {
            w.scrollBy({
              left: parentRects.left,
              top: parentRects.top,
              behavior: 'smooth'
            });
          }
        } else {
          // reveal element in viewport
          w.scrollBy({
            left: clientRects.left,
            top: clientRects.top,
            behavior: 'smooth'
          });
        }
      };
    }

    {
      // commonjs
      module.exports = { polyfill: polyfill };
    }

  }());
  });
  var smoothscroll_1 = smoothscroll.polyfill;

  var _default$1 = /*#__PURE__*/function (_Core) {
    _inherits(_default, _Core);

    var _super = _createSuper(_default);

    function _default() {
      var _this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, _default);

      _this = _super.call(this, options);

      if (_this.resetNativeScroll) {
        if (history.scrollRestoration) {
          history.scrollRestoration = 'manual';
        }

        window.scrollTo(0, 0);
      }

      window.addEventListener('scroll', _this.checkScroll, false);

      if (window.smoothscrollPolyfill === undefined) {
        window.smoothscrollPolyfill = smoothscroll;
        window.smoothscrollPolyfill.polyfill();
      }

      return _this;
    }

    _createClass(_default, [{
      key: "init",
      value: function init() {
        this.instance.scroll.y = window.pageYOffset;
        this.addElements();
        this.detectElements();

        _get(_getPrototypeOf(_default.prototype), "init", this).call(this);
      }
    }, {
      key: "checkScroll",
      value: function checkScroll() {
        var _this2 = this;

        _get(_getPrototypeOf(_default.prototype), "checkScroll", this).call(this);

        if (this.getDirection) {
          this.addDirection();
        }

        if (this.getSpeed) {
          this.addSpeed();
          this.speedTs = Date.now();
        }

        this.instance.scroll.y = window.pageYOffset;

        if (Object.entries(this.els).length) {
          if (!this.hasScrollTicking) {
            requestAnimationFrame(function () {
              _this2.detectElements();
            });
            this.hasScrollTicking = true;
          }
        }
      }
    }, {
      key: "addDirection",
      value: function addDirection() {
        if (window.pageYOffset > this.instance.scroll.y) {
          if (this.instance.direction !== 'down') {
            this.instance.direction = 'down';
          }
        } else if (window.pageYOffset < this.instance.scroll.y) {
          if (this.instance.direction !== 'up') {
            this.instance.direction = 'up';
          }
        }
      }
    }, {
      key: "addSpeed",
      value: function addSpeed() {
        if (window.pageYOffset != this.instance.scroll.y) {
          this.instance.speed = (window.pageYOffset - this.instance.scroll.y) / Math.max(1, Date.now() - this.speedTs);
        } else {
          this.instance.speed = 0;
        }
      }
    }, {
      key: "resize",
      value: function resize() {
        if (Object.entries(this.els).length) {
          this.windowHeight = window.innerHeight;
          this.updateElements();
        }
      }
    }, {
      key: "addElements",
      value: function addElements() {
        var _this3 = this;

        this.els = {};
        var els = this.el.querySelectorAll('[data-' + this.name + ']');
        els.forEach(function (el, index) {
          var BCR = el.getBoundingClientRect();
          var cl = el.dataset[_this3.name + 'Class'] || _this3["class"];
          var id = typeof el.dataset[_this3.name + 'Id'] === 'string' ? el.dataset[_this3.name + 'Id'] : index;
          var top;
          var left;
          var offset = typeof el.dataset[_this3.name + 'Offset'] === 'string' ? el.dataset[_this3.name + 'Offset'].split(',') : _this3.offset;
          var repeat = el.dataset[_this3.name + 'Repeat'];
          var call = el.dataset[_this3.name + 'Call'];
          var target = el.dataset[_this3.name + 'Target'];
          var targetEl;

          if (target !== undefined) {
            targetEl = document.querySelector("".concat(target));
          } else {
            targetEl = el;
          }

          var targetElBCR = targetEl.getBoundingClientRect();
          top = targetElBCR.top + _this3.instance.scroll.y;
          left = targetElBCR.left + _this3.instance.scroll.x;
          var bottom = top + targetEl.offsetHeight;
          var right = left + targetEl.offsetWidth;

          if (repeat == 'false') {
            repeat = false;
          } else if (repeat != undefined) {
            repeat = true;
          } else {
            repeat = _this3.repeat;
          }

          var relativeOffset = _this3.getRelativeOffset(offset);

          top = top + relativeOffset[0];
          bottom = bottom - relativeOffset[1];
          var mappedEl = {
            el: el,
            targetEl: targetEl,
            id: id,
            "class": cl,
            top: top,
            bottom: bottom,
            left: left,
            right: right,
            offset: offset,
            progress: 0,
            repeat: repeat,
            inView: false,
            call: call
          };
          _this3.els[id] = mappedEl;

          if (el.classList.contains(cl)) {
            _this3.setInView(_this3.els[id], id);
          }
        });
      }
    }, {
      key: "updateElements",
      value: function updateElements() {
        var _this4 = this;

        Object.entries(this.els).forEach(function (_ref) {
          var _ref2 = _slicedToArray(_ref, 2),
              i = _ref2[0],
              el = _ref2[1];

          var top = el.targetEl.getBoundingClientRect().top + _this4.instance.scroll.y;

          var bottom = top + el.targetEl.offsetHeight;

          var relativeOffset = _this4.getRelativeOffset(el.offset);

          _this4.els[i].top = top + relativeOffset[0];
          _this4.els[i].bottom = bottom - relativeOffset[1];
        });
        this.hasScrollTicking = false;
      }
    }, {
      key: "getRelativeOffset",
      value: function getRelativeOffset(offset) {
        var relativeOffset = [0, 0];

        if (offset) {
          for (var i = 0; i < offset.length; i++) {
            if (typeof offset[i] == 'string') {
              if (offset[i].includes('%')) {
                relativeOffset[i] = parseInt(offset[i].replace('%', '') * this.windowHeight / 100);
              } else {
                relativeOffset[i] = parseInt(offset[i]);
              }
            } else {
              relativeOffset[i] = offset[i];
            }
          }
        }

        return relativeOffset;
      }
      /**
       * Scroll to a desired target.
       *
       * @param  Available options :
       *          target {node, string, "top", "bottom", int} - The DOM element we want to scroll to
       *          options {object} - Options object for additionnal settings.
       * @return {void}
       */

    }, {
      key: "scrollTo",
      value: function scrollTo(target) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // Parse options
        var offset = parseInt(options.offset) || 0; // An offset to apply on top of given `target` or `sourceElem`'s target

        var callback = options.callback ? options.callback : false; // function called when scrollTo completes (note that it won't wait for lerp to stabilize)

        if (typeof target === 'string') {
          // Selector or boundaries
          if (target === 'top') {
            target = this.html;
          } else if (target === 'bottom') {
            target = this.html.offsetHeight - window.innerHeight;
          } else {
            target = document.querySelector(target); // If the query fails, abort

            if (!target) {
              return;
            }
          }
        } else if (typeof target === 'number') {
          // Absolute coordinate
          target = parseInt(target);
        } else if (target && target.tagName) ; else {
          console.warn('`target` parameter is not valid');
          return;
        } // We have a target that is not a coordinate yet, get it


        if (typeof target !== 'number') {
          offset = target.getBoundingClientRect().top + offset + this.instance.scroll.y;
        } else {
          offset = target + offset;
        }

        var isTargetReached = function isTargetReached() {
          return parseInt(window.pageYOffset) === parseInt(offset);
        };

        if (callback) {
          if (isTargetReached()) {
            callback();
            return;
          } else {
            var onScroll = function onScroll() {
              if (isTargetReached()) {
                window.removeEventListener('scroll', onScroll);
                callback();
              }
            };

            window.addEventListener('scroll', onScroll);
          }
        }

        window.scrollTo({
          top: offset,
          behavior: options.duration === 0 ? 'auto' : 'smooth'
        });
      }
    }, {
      key: "update",
      value: function update() {
        this.addElements();
        this.detectElements();
      }
    }, {
      key: "destroy",
      value: function destroy() {
        _get(_getPrototypeOf(_default.prototype), "destroy", this).call(this);

        window.removeEventListener('scroll', this.checkScroll, false);
      }
    }]);

    return _default;
  }(_default);

  /*
  object-assign
  (c) Sindre Sorhus
  @license MIT
  */
  /* eslint-disable no-unused-vars */
  var getOwnPropertySymbols = Object.getOwnPropertySymbols;
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var propIsEnumerable = Object.prototype.propertyIsEnumerable;

  function toObject(val) {
  	if (val === null || val === undefined) {
  		throw new TypeError('Object.assign cannot be called with null or undefined');
  	}

  	return Object(val);
  }

  function shouldUseNative$1() {
  	try {
  		if (!Object.assign) {
  			return false;
  		}

  		// Detect buggy property enumeration order in older V8 versions.

  		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
  		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
  		test1[5] = 'de';
  		if (Object.getOwnPropertyNames(test1)[0] === '5') {
  			return false;
  		}

  		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
  		var test2 = {};
  		for (var i = 0; i < 10; i++) {
  			test2['_' + String.fromCharCode(i)] = i;
  		}
  		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
  			return test2[n];
  		});
  		if (order2.join('') !== '0123456789') {
  			return false;
  		}

  		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
  		var test3 = {};
  		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
  			test3[letter] = letter;
  		});
  		if (Object.keys(Object.assign({}, test3)).join('') !==
  				'abcdefghijklmnopqrst') {
  			return false;
  		}

  		return true;
  	} catch (err) {
  		// We don't expect any of the above to throw, but better to be safe.
  		return false;
  	}
  }

  var objectAssign = shouldUseNative$1() ? Object.assign : function (target, source) {
  	var from;
  	var to = toObject(target);
  	var symbols;

  	for (var s = 1; s < arguments.length; s++) {
  		from = Object(arguments[s]);

  		for (var key in from) {
  			if (hasOwnProperty.call(from, key)) {
  				to[key] = from[key];
  			}
  		}

  		if (getOwnPropertySymbols) {
  			symbols = getOwnPropertySymbols(from);
  			for (var i = 0; i < symbols.length; i++) {
  				if (propIsEnumerable.call(from, symbols[i])) {
  					to[symbols[i]] = from[symbols[i]];
  				}
  			}
  		}
  	}

  	return to;
  };

  function E () {
    // Keep this empty so it's easier to inherit from
    // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
  }

  E.prototype = {
    on: function (name, callback, ctx) {
      var e = this.e || (this.e = {});

      (e[name] || (e[name] = [])).push({
        fn: callback,
        ctx: ctx
      });

      return this;
    },

    once: function (name, callback, ctx) {
      var self = this;
      function listener () {
        self.off(name, listener);
        callback.apply(ctx, arguments);
      }
      listener._ = callback;
      return this.on(name, listener, ctx);
    },

    emit: function (name) {
      var data = [].slice.call(arguments, 1);
      var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
      var i = 0;
      var len = evtArr.length;

      for (i; i < len; i++) {
        evtArr[i].fn.apply(evtArr[i].ctx, data);
      }

      return this;
    },

    off: function (name, callback) {
      var e = this.e || (this.e = {});
      var evts = e[name];
      var liveEvents = [];

      if (evts && callback) {
        for (var i = 0, len = evts.length; i < len; i++) {
          if (evts[i].fn !== callback && evts[i].fn._ !== callback)
            liveEvents.push(evts[i]);
        }
      }

      // Remove event from queue to prevent memory leak
      // Suggested by https://github.com/lazd
      // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

      (liveEvents.length)
        ? e[name] = liveEvents
        : delete e[name];

      return this;
    }
  };

  var tinyEmitter = E;

  var lethargy = createCommonjsModule(function (module, exports) {
  // Generated by CoffeeScript 1.9.2
  (function() {
    var root;

    root =  exports !== null ? exports : this;

    root.Lethargy = (function() {
      function Lethargy(stability, sensitivity, tolerance, delay) {
        this.stability = stability != null ? Math.abs(stability) : 8;
        this.sensitivity = sensitivity != null ? 1 + Math.abs(sensitivity) : 100;
        this.tolerance = tolerance != null ? 1 + Math.abs(tolerance) : 1.1;
        this.delay = delay != null ? delay : 150;
        this.lastUpDeltas = (function() {
          var i, ref, results;
          results = [];
          for (i = 1, ref = this.stability * 2; 1 <= ref ? i <= ref : i >= ref; 1 <= ref ? i++ : i--) {
            results.push(null);
          }
          return results;
        }).call(this);
        this.lastDownDeltas = (function() {
          var i, ref, results;
          results = [];
          for (i = 1, ref = this.stability * 2; 1 <= ref ? i <= ref : i >= ref; 1 <= ref ? i++ : i--) {
            results.push(null);
          }
          return results;
        }).call(this);
        this.deltasTimestamp = (function() {
          var i, ref, results;
          results = [];
          for (i = 1, ref = this.stability * 2; 1 <= ref ? i <= ref : i >= ref; 1 <= ref ? i++ : i--) {
            results.push(null);
          }
          return results;
        }).call(this);
      }

      Lethargy.prototype.check = function(e) {
        var lastDelta;
        e = e.originalEvent || e;
        if (e.wheelDelta != null) {
          lastDelta = e.wheelDelta;
        } else if (e.deltaY != null) {
          lastDelta = e.deltaY * -40;
        } else if ((e.detail != null) || e.detail === 0) {
          lastDelta = e.detail * -40;
        }
        this.deltasTimestamp.push(Date.now());
        this.deltasTimestamp.shift();
        if (lastDelta > 0) {
          this.lastUpDeltas.push(lastDelta);
          this.lastUpDeltas.shift();
          return this.isInertia(1);
        } else {
          this.lastDownDeltas.push(lastDelta);
          this.lastDownDeltas.shift();
          return this.isInertia(-1);
        }
      };

      Lethargy.prototype.isInertia = function(direction) {
        var lastDeltas, lastDeltasNew, lastDeltasOld, newAverage, newSum, oldAverage, oldSum;
        lastDeltas = direction === -1 ? this.lastDownDeltas : this.lastUpDeltas;
        if (lastDeltas[0] === null) {
          return direction;
        }
        if (this.deltasTimestamp[(this.stability * 2) - 2] + this.delay > Date.now() && lastDeltas[0] === lastDeltas[(this.stability * 2) - 1]) {
          return false;
        }
        lastDeltasOld = lastDeltas.slice(0, this.stability);
        lastDeltasNew = lastDeltas.slice(this.stability, this.stability * 2);
        oldSum = lastDeltasOld.reduce(function(t, s) {
          return t + s;
        });
        newSum = lastDeltasNew.reduce(function(t, s) {
          return t + s;
        });
        oldAverage = oldSum / lastDeltasOld.length;
        newAverage = newSum / lastDeltasNew.length;
        if (Math.abs(oldAverage) < Math.abs(newAverage * this.tolerance) && (this.sensitivity < Math.abs(newAverage))) {
          return direction;
        } else {
          return false;
        }
      };

      Lethargy.prototype.showLastUpDeltas = function() {
        return this.lastUpDeltas;
      };

      Lethargy.prototype.showLastDownDeltas = function() {
        return this.lastDownDeltas;
      };

      return Lethargy;

    })();

  }).call(commonjsGlobal);
  });

  var support = (function getSupport() {
      return {
          hasWheelEvent: 'onwheel' in document,
          hasMouseWheelEvent: 'onmousewheel' in document,
          hasTouch: ('ontouchstart' in window) || window.TouchEvent || window.DocumentTouch && document instanceof DocumentTouch,
          hasTouchWin: navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 1,
          hasPointer: !!window.navigator.msPointerEnabled,
          hasKeyDown: 'onkeydown' in document,
          isFirefox: navigator.userAgent.indexOf('Firefox') > -1
      };
  })();

  var toString = Object.prototype.toString,
      hasOwnProperty$1 = Object.prototype.hasOwnProperty;

  var bindallStandalone = function(object) {
      if(!object) return console.warn('bindAll requires at least one argument.');

      var functions = Array.prototype.slice.call(arguments, 1);

      if (functions.length === 0) {

          for (var method in object) {
              if(hasOwnProperty$1.call(object, method)) {
                  if(typeof object[method] == 'function' && toString.call(object[method]) == "[object Function]") {
                      functions.push(method);
                  }
              }
          }
      }

      for(var i = 0; i < functions.length; i++) {
          var f = functions[i];
          object[f] = bind(object[f], object);
      }
  };

  /*
      Faster bind without specific-case checking. (see https://coderwall.com/p/oi3j3w).
      bindAll is only needed for events binding so no need to make slow fixes for constructor
      or partial application.
  */
  function bind(func, context) {
    return function() {
      return func.apply(context, arguments);
    };
  }

  var Lethargy = lethargy.Lethargy;



  var EVT_ID = 'virtualscroll';

  var src = VirtualScroll;

  var keyCodes = {
      LEFT: 37,
      UP: 38,
      RIGHT: 39,
      DOWN: 40,
      SPACE: 32
  };

  function VirtualScroll(options) {
      bindallStandalone(this, '_onWheel', '_onMouseWheel', '_onTouchStart', '_onTouchMove', '_onKeyDown');

      this.el = window;
      if (options && options.el) {
          this.el = options.el;
          delete options.el;
      }
      this.options = objectAssign({
          mouseMultiplier: 1,
          touchMultiplier: 2,
          firefoxMultiplier: 15,
          keyStep: 120,
          preventTouch: false,
          unpreventTouchClass: 'vs-touchmove-allowed',
          limitInertia: false,
          useKeyboard: true,
          useTouch: true
      }, options);

      if (this.options.limitInertia) this._lethargy = new Lethargy();

      this._emitter = new tinyEmitter();
      this._event = {
          y: 0,
          x: 0,
          deltaX: 0,
          deltaY: 0
      };
      this.touchStartX = null;
      this.touchStartY = null;
      this.bodyTouchAction = null;

      if (this.options.passive !== undefined) {
          this.listenerOptions = {passive: this.options.passive};
      }
  }

  VirtualScroll.prototype._notify = function(e) {
      var evt = this._event;
      evt.x += evt.deltaX;
      evt.y += evt.deltaY;

     this._emitter.emit(EVT_ID, {
          x: evt.x,
          y: evt.y,
          deltaX: evt.deltaX,
          deltaY: evt.deltaY,
          originalEvent: e
     });
  };

  VirtualScroll.prototype._onWheel = function(e) {
      var options = this.options;
      if (this._lethargy && this._lethargy.check(e) === false) return;
      var evt = this._event;

      // In Chrome and in Firefox (at least the new one)
      evt.deltaX = e.wheelDeltaX || e.deltaX * -1;
      evt.deltaY = e.wheelDeltaY || e.deltaY * -1;

      // for our purpose deltamode = 1 means user is on a wheel mouse, not touch pad
      // real meaning: https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent#Delta_modes
      if(support.isFirefox && e.deltaMode == 1) {
          evt.deltaX *= options.firefoxMultiplier;
          evt.deltaY *= options.firefoxMultiplier;
      }

      evt.deltaX *= options.mouseMultiplier;
      evt.deltaY *= options.mouseMultiplier;

      this._notify(e);
  };

  VirtualScroll.prototype._onMouseWheel = function(e) {
      if (this.options.limitInertia && this._lethargy.check(e) === false) return;

      var evt = this._event;

      // In Safari, IE and in Chrome if 'wheel' isn't defined
      evt.deltaX = (e.wheelDeltaX) ? e.wheelDeltaX : 0;
      evt.deltaY = (e.wheelDeltaY) ? e.wheelDeltaY : e.wheelDelta;

      this._notify(e);
  };

  VirtualScroll.prototype._onTouchStart = function(e) {
      var t = (e.targetTouches) ? e.targetTouches[0] : e;
      this.touchStartX = t.pageX;
      this.touchStartY = t.pageY;
  };

  VirtualScroll.prototype._onTouchMove = function(e) {
      var options = this.options;
      if(options.preventTouch
          && !e.target.classList.contains(options.unpreventTouchClass)) {
          e.preventDefault();
      }

      var evt = this._event;

      var t = (e.targetTouches) ? e.targetTouches[0] : e;

      evt.deltaX = (t.pageX - this.touchStartX) * options.touchMultiplier;
      evt.deltaY = (t.pageY - this.touchStartY) * options.touchMultiplier;

      this.touchStartX = t.pageX;
      this.touchStartY = t.pageY;

      this._notify(e);
  };

  VirtualScroll.prototype._onKeyDown = function(e) {
      var evt = this._event;
      evt.deltaX = evt.deltaY = 0;
      var windowHeight = window.innerHeight - 40;

      switch(e.keyCode) {
          case keyCodes.LEFT:
          case keyCodes.UP:
              evt.deltaY = this.options.keyStep;
              break;

          case keyCodes.RIGHT:
          case keyCodes.DOWN:
              evt.deltaY = - this.options.keyStep;
              break;
          case  e.shiftKey:
              evt.deltaY = windowHeight;
              break;
          case keyCodes.SPACE:
              evt.deltaY = - windowHeight;
              break;
          default:
              return;
      }

      this._notify(e);
  };

  VirtualScroll.prototype._bind = function() {
      if(support.hasWheelEvent) this.el.addEventListener('wheel', this._onWheel, this.listenerOptions);
      if(support.hasMouseWheelEvent) this.el.addEventListener('mousewheel', this._onMouseWheel, this.listenerOptions);

      if(support.hasTouch && this.options.useTouch) {
          this.el.addEventListener('touchstart', this._onTouchStart, this.listenerOptions);
          this.el.addEventListener('touchmove', this._onTouchMove, this.listenerOptions);
      }

      if(support.hasPointer && support.hasTouchWin) {
          this.bodyTouchAction = document.body.style.msTouchAction;
          document.body.style.msTouchAction = 'none';
          this.el.addEventListener('MSPointerDown', this._onTouchStart, true);
          this.el.addEventListener('MSPointerMove', this._onTouchMove, true);
      }

      if(support.hasKeyDown && this.options.useKeyboard) document.addEventListener('keydown', this._onKeyDown);
  };

  VirtualScroll.prototype._unbind = function() {
      if(support.hasWheelEvent) this.el.removeEventListener('wheel', this._onWheel);
      if(support.hasMouseWheelEvent) this.el.removeEventListener('mousewheel', this._onMouseWheel);

      if(support.hasTouch) {
          this.el.removeEventListener('touchstart', this._onTouchStart);
          this.el.removeEventListener('touchmove', this._onTouchMove);
      }

      if(support.hasPointer && support.hasTouchWin) {
          document.body.style.msTouchAction = this.bodyTouchAction;
          this.el.removeEventListener('MSPointerDown', this._onTouchStart, true);
          this.el.removeEventListener('MSPointerMove', this._onTouchMove, true);
      }

      if(support.hasKeyDown && this.options.useKeyboard) document.removeEventListener('keydown', this._onKeyDown);
  };

  VirtualScroll.prototype.on = function(cb, ctx) {
    this._emitter.on(EVT_ID, cb, ctx);

    var events = this._emitter.e;
    if (events && events[EVT_ID] && events[EVT_ID].length === 1) this._bind();
  };

  VirtualScroll.prototype.off = function(cb, ctx) {
    this._emitter.off(EVT_ID, cb, ctx);

    var events = this._emitter.e;
    if (!events[EVT_ID] || events[EVT_ID].length <= 0) this._unbind();
  };

  VirtualScroll.prototype.reset = function() {
      var evt = this._event;
      evt.x = 0;
      evt.y = 0;
  };

  VirtualScroll.prototype.destroy = function() {
      this._emitter.off();
      this._unbind();
  };

  function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }

  function getTranslate(el) {
    var translate = {};
    if (!window.getComputedStyle) return;
    var style = getComputedStyle(el);
    var transform = style.transform || style.webkitTransform || style.mozTransform;
    var mat = transform.match(/^matrix3d\((.+)\)$/);

    if (mat) {
      translate.x = mat ? parseFloat(mat[1].split(', ')[12]) : 0;
      translate.y = mat ? parseFloat(mat[1].split(', ')[13]) : 0;
    } else {
      mat = transform.match(/^matrix\((.+)\)$/);
      translate.x = mat ? parseFloat(mat[1].split(', ')[4]) : 0;
      translate.y = mat ? parseFloat(mat[1].split(', ')[5]) : 0;
    }

    return translate;
  }

  /**
   * Returns an array containing all the parent nodes of the given node
   * @param  {object} node
   * @return {array} parent nodes
   */
  function getParents(elem) {
    // Set up a parent array
    var parents = []; // Push each parent element to the array

    for (; elem && elem !== document; elem = elem.parentNode) {
      parents.push(elem);
    } // Return our parent array


    return parents;
  } // https://gomakethings.com/how-to-get-the-closest-parent-element-with-a-matching-selector-using-vanilla-javascript/

  /**
   * https://github.com/gre/bezier-easing
   * BezierEasing - use bezier curve for transition easing function
   * by Gaëtan Renaudeau 2014 - 2015 – MIT License
   */

  // These values are established by empiricism with tests (tradeoff: performance VS precision)
  var NEWTON_ITERATIONS = 4;
  var NEWTON_MIN_SLOPE = 0.001;
  var SUBDIVISION_PRECISION = 0.0000001;
  var SUBDIVISION_MAX_ITERATIONS = 10;

  var kSplineTableSize = 11;
  var kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

  var float32ArraySupported = typeof Float32Array === 'function';

  function A (aA1, aA2) { return 1.0 - 3.0 * aA2 + 3.0 * aA1; }
  function B (aA1, aA2) { return 3.0 * aA2 - 6.0 * aA1; }
  function C (aA1)      { return 3.0 * aA1; }

  // Returns x(t) given t, x1, and x2, or y(t) given t, y1, and y2.
  function calcBezier (aT, aA1, aA2) { return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT; }

  // Returns dx/dt given t, x1, and x2, or dy/dt given t, y1, and y2.
  function getSlope (aT, aA1, aA2) { return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1); }

  function binarySubdivide (aX, aA, aB, mX1, mX2) {
    var currentX, currentT, i = 0;
    do {
      currentT = aA + (aB - aA) / 2.0;
      currentX = calcBezier(currentT, mX1, mX2) - aX;
      if (currentX > 0.0) {
        aB = currentT;
      } else {
        aA = currentT;
      }
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  }

  function newtonRaphsonIterate (aX, aGuessT, mX1, mX2) {
   for (var i = 0; i < NEWTON_ITERATIONS; ++i) {
     var currentSlope = getSlope(aGuessT, mX1, mX2);
     if (currentSlope === 0.0) {
       return aGuessT;
     }
     var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
     aGuessT -= currentX / currentSlope;
   }
   return aGuessT;
  }

  function LinearEasing (x) {
    return x;
  }

  var src$1 = function bezier (mX1, mY1, mX2, mY2) {
    if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) {
      throw new Error('bezier x values must be in [0, 1] range');
    }

    if (mX1 === mY1 && mX2 === mY2) {
      return LinearEasing;
    }

    // Precompute samples table
    var sampleValues = float32ArraySupported ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);
    for (var i = 0; i < kSplineTableSize; ++i) {
      sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
    }

    function getTForX (aX) {
      var intervalStart = 0.0;
      var currentSample = 1;
      var lastSample = kSplineTableSize - 1;

      for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
        intervalStart += kSampleStepSize;
      }
      --currentSample;

      // Interpolate to provide an initial guess for t
      var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
      var guessForT = intervalStart + dist * kSampleStepSize;

      var initialSlope = getSlope(guessForT, mX1, mX2);
      if (initialSlope >= NEWTON_MIN_SLOPE) {
        return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
      } else if (initialSlope === 0.0) {
        return guessForT;
      } else {
        return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
      }
    }

    return function BezierEasing (x) {
      // Because JavaScript number are imprecise, we should guarantee the extremes are right.
      if (x === 0) {
        return 0;
      }
      if (x === 1) {
        return 1;
      }
      return calcBezier(getTForX(x), mY1, mY2);
    };
  };

  var keyCodes$1 = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    SPACE: 32,
    TAB: 9,
    PAGEUP: 33,
    PAGEDOWN: 34,
    HOME: 36,
    END: 35
  };

  var _default$2 = /*#__PURE__*/function (_Core) {
    _inherits(_default, _Core);

    var _super = _createSuper(_default);

    function _default() {
      var _this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, _default);

      if (history.scrollRestoration) {
        history.scrollRestoration = 'manual';
      }

      window.scrollTo(0, 0);
      _this = _super.call(this, options);
      if (_this.inertia) _this.lerp = _this.inertia * 0.1;
      _this.isScrolling = false;
      _this.isDraggingScrollbar = false;
      _this.isTicking = false;
      _this.hasScrollTicking = false;
      _this.parallaxElements = {};
      _this.stop = false;
      _this.scrollbarContainer = options.scrollbarContainer;
      _this.checkKey = _this.checkKey.bind(_assertThisInitialized(_this));
      window.addEventListener('keydown', _this.checkKey, false);
      return _this;
    }

    _createClass(_default, [{
      key: "init",
      value: function init() {
        var _this2 = this;

        this.html.classList.add(this.smoothClass);
        this.html.setAttribute("data-".concat(this.name, "-direction"), this.direction);
        this.instance = _objectSpread2({
          delta: {
            x: this.initPosition.x,
            y: this.initPosition.y
          },
          scroll: {
            x: this.initPosition.x,
            y: this.initPosition.y
          }
        }, this.instance);
        this.vs = new src({
          el: this.scrollFromAnywhere ? document : this.el,
          mouseMultiplier: navigator.platform.indexOf('Win') > -1 ? 1 : 0.4,
          firefoxMultiplier: this.firefoxMultiplier,
          touchMultiplier: this.touchMultiplier,
          useKeyboard: false,
          passive: true
        });
        this.vs.on(function (e) {
          if (_this2.stop) {
            return;
          }

          if (!_this2.isDraggingScrollbar) {
            requestAnimationFrame(function () {
              _this2.updateDelta(e);

              if (!_this2.isScrolling) _this2.startScrolling();
            });
          }
        });
        this.setScrollLimit();
        this.initScrollBar();
        this.addSections();
        this.addElements();
        this.checkScroll(true);
        this.transformElements(true, true);

        _get(_getPrototypeOf(_default.prototype), "init", this).call(this);
      }
    }, {
      key: "setScrollLimit",
      value: function setScrollLimit() {
        this.instance.limit.y = this.el.offsetHeight - this.windowHeight;

        if (this.direction === 'horizontal') {
          var totalWidth = 0;
          var nodes = this.el.children;

          for (var i = 0; i < nodes.length; i++) {
            totalWidth += nodes[i].offsetWidth;
          }

          this.instance.limit.x = totalWidth - this.windowWidth;
        }
      }
    }, {
      key: "startScrolling",
      value: function startScrolling() {
        this.startScrollTs = Date.now(); // Record timestamp

        this.isScrolling = true;
        this.checkScroll();
        this.html.classList.add(this.scrollingClass);
      }
    }, {
      key: "stopScrolling",
      value: function stopScrolling() {
        cancelAnimationFrame(this.checkScrollRaf); // Prevent checkScroll to continue looping
        //Pevent scrollbar glitch/locking

        this.startScrollTs = undefined;

        if (this.scrollToRaf) {
          cancelAnimationFrame(this.scrollToRaf);
          this.scrollToRaf = null;
        }

        this.isScrolling = false;
        this.instance.scroll.y = Math.round(this.instance.scroll.y);
        this.html.classList.remove(this.scrollingClass);
      }
    }, {
      key: "checkKey",
      value: function checkKey(e) {
        var _this3 = this;

        if (this.stop) {
          // If we are stopped, we don't want any scroll to occur because of a keypress
          // Prevent tab to scroll to activeElement
          if (e.keyCode == keyCodes$1.TAB) {
            requestAnimationFrame(function () {
              // Make sure native scroll is always at top of page
              _this3.html.scrollTop = 0;
              document.body.scrollTop = 0;
              _this3.html.scrollLeft = 0;
              document.body.scrollLeft = 0;
            });
          }

          return;
        }

        switch (e.keyCode) {
          case keyCodes$1.TAB:
            // Do not remove the RAF
            // It allows to override the browser's native scrollTo, which is essential
            requestAnimationFrame(function () {
              // Make sure native scroll is always at top of page
              _this3.html.scrollTop = 0;
              document.body.scrollTop = 0;
              _this3.html.scrollLeft = 0;
              document.body.scrollLeft = 0; // Request scrollTo on the focusedElement, putting it at the center of the screen

              _this3.scrollTo(document.activeElement, {
                offset: -window.innerHeight / 2
              });
            });
            break;

          case keyCodes$1.UP:
            this.instance.delta[this.directionAxis] -= 240;
            break;

          case keyCodes$1.DOWN:
            this.instance.delta[this.directionAxis] += 240;
            break;

          case keyCodes$1.PAGEUP:
            this.instance.delta[this.directionAxis] -= window.innerHeight;
            break;

          case keyCodes$1.PAGEDOWN:
            this.instance.delta[this.directionAxis] += window.innerHeight;
            break;

          case keyCodes$1.HOME:
            this.instance.delta[this.directionAxis] -= this.instance.limit[this.directionAxis];
            break;

          case keyCodes$1.END:
            this.instance.delta[this.directionAxis] += this.instance.limit[this.directionAxis];
            break;

          case keyCodes$1.SPACE:
            if (!(document.activeElement instanceof HTMLInputElement) && !(document.activeElement instanceof HTMLTextAreaElement)) {
              if (e.shiftKey) {
                this.instance.delta[this.directionAxis] -= window.innerHeight;
              } else {
                this.instance.delta[this.directionAxis] += window.innerHeight;
              }
            }

            break;

          default:
            return;
        }

        if (this.instance.delta[this.directionAxis] < 0) this.instance.delta[this.directionAxis] = 0;
        if (this.instance.delta[this.directionAxis] > this.instance.limit[this.directionAxis]) this.instance.delta[this.directionAxis] = this.instance.limit[this.directionAxis];
        this.stopScrolling(); // Stop any movement, allows to kill any other `scrollTo` still happening

        this.isScrolling = true;
        this.checkScroll();
        this.html.classList.add(this.scrollingClass);
      }
    }, {
      key: "checkScroll",
      value: function checkScroll() {
        var _this4 = this;

        var forced = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

        if (forced || this.isScrolling || this.isDraggingScrollbar) {
          if (!this.hasScrollTicking) {
            this.checkScrollRaf = requestAnimationFrame(function () {
              return _this4.checkScroll();
            });
            this.hasScrollTicking = true;
          }

          this.updateScroll();
          var distance = Math.abs(this.instance.delta[this.directionAxis] - this.instance.scroll[this.directionAxis]);
          var timeSinceStart = Date.now() - this.startScrollTs; // Get the time since the scroll was started: the scroll can be stopped again only past 100ms

          if (!this.animatingScroll && timeSinceStart > 100 && (distance < 0.5 && this.instance.delta[this.directionAxis] != 0 || distance < 0.5 && this.instance.delta[this.directionAxis] == 0)) {
            this.stopScrolling();
          }

          Object.entries(this.sections).forEach(function (_ref) {
            var _ref2 = _slicedToArray(_ref, 2),
                i = _ref2[0],
                section = _ref2[1];

            if (section.persistent || _this4.instance.scroll[_this4.directionAxis] > section.offset[_this4.directionAxis] && _this4.instance.scroll[_this4.directionAxis] < section.limit[_this4.directionAxis]) {
              if (_this4.direction === 'horizontal') {
                _this4.transform(section.el, -_this4.instance.scroll[_this4.directionAxis], 0);
              } else {
                _this4.transform(section.el, 0, -_this4.instance.scroll[_this4.directionAxis]);
              }

              if (!section.inView) {
                section.inView = true;
                section.el.style.opacity = 1;
                section.el.style.pointerEvents = 'all';
                section.el.setAttribute("data-".concat(_this4.name, "-section-inview"), '');
              }
            } else {
              if (section.inView || forced) {
                section.inView = false;
                section.el.style.opacity = 0;
                section.el.style.pointerEvents = 'none';
                section.el.removeAttribute("data-".concat(_this4.name, "-section-inview"));
              }

              _this4.transform(section.el, 0, 0);
            }
          });

          if (this.getDirection) {
            this.addDirection();
          }

          if (this.getSpeed) {
            this.addSpeed();
            this.speedTs = Date.now();
          }

          this.detectElements();
          this.transformElements();

          if (this.hasScrollbar) {
            var scrollBarTranslation = this.instance.scroll[this.directionAxis] / this.instance.limit[this.directionAxis] * this.scrollBarLimit[this.directionAxis];

            if (this.direction === 'horizontal') {
              this.transform(this.scrollbarThumb, scrollBarTranslation, 0);
            } else {
              this.transform(this.scrollbarThumb, 0, scrollBarTranslation);
            }
          }

          _get(_getPrototypeOf(_default.prototype), "checkScroll", this).call(this);

          this.hasScrollTicking = false;
        }
      }
    }, {
      key: "resize",
      value: function resize() {
        this.windowHeight = window.innerHeight;
        this.windowWidth = window.innerWidth;
        this.checkContext();
        this.windowMiddle = {
          x: this.windowWidth / 2,
          y: this.windowHeight / 2
        };
        this.update();
      }
    }, {
      key: "updateDelta",
      value: function updateDelta(e) {
        var delta;
        var gestureDirection = this[this.context] && this[this.context].gestureDirection ? this[this.context].gestureDirection : this.gestureDirection;

        if (gestureDirection === 'both') {
          delta = e.deltaX + e.deltaY;
        } else if (gestureDirection === 'vertical') {
          delta = e.deltaY;
        } else if (gestureDirection === 'horizontal') {
          delta = e.deltaX;
        } else {
          delta = e.deltaY;
        }

        this.instance.delta[this.directionAxis] -= delta * this.multiplier;
        if (this.instance.delta[this.directionAxis] < 0) this.instance.delta[this.directionAxis] = 0;
        if (this.instance.delta[this.directionAxis] > this.instance.limit[this.directionAxis]) this.instance.delta[this.directionAxis] = this.instance.limit[this.directionAxis];
      }
    }, {
      key: "updateScroll",
      value: function updateScroll(e) {
        if (this.isScrolling || this.isDraggingScrollbar) {
          this.instance.scroll[this.directionAxis] = lerp(this.instance.scroll[this.directionAxis], this.instance.delta[this.directionAxis], this.lerp);
        } else {
          if (this.instance.scroll[this.directionAxis] > this.instance.limit[this.directionAxis]) {
            this.setScroll(this.instance.scroll[this.directionAxis], this.instance.limit[this.directionAxis]);
          } else if (this.instance.scroll.y < 0) {
            this.setScroll(this.instance.scroll[this.directionAxis], 0);
          } else {
            this.setScroll(this.instance.scroll[this.directionAxis], this.instance.delta[this.directionAxis]);
          }
        }
      }
    }, {
      key: "addDirection",
      value: function addDirection() {
        if (this.instance.delta.y > this.instance.scroll.y) {
          if (this.instance.direction !== 'down') {
            this.instance.direction = 'down';
          }
        } else if (this.instance.delta.y < this.instance.scroll.y) {
          if (this.instance.direction !== 'up') {
            this.instance.direction = 'up';
          }
        }

        if (this.instance.delta.x > this.instance.scroll.x) {
          if (this.instance.direction !== 'right') {
            this.instance.direction = 'right';
          }
        } else if (this.instance.delta.x < this.instance.scroll.x) {
          if (this.instance.direction !== 'left') {
            this.instance.direction = 'left';
          }
        }
      }
    }, {
      key: "addSpeed",
      value: function addSpeed() {
        if (this.instance.delta[this.directionAxis] != this.instance.scroll[this.directionAxis]) {
          this.instance.speed = (this.instance.delta[this.directionAxis] - this.instance.scroll[this.directionAxis]) / Math.max(1, Date.now() - this.speedTs);
        } else {
          this.instance.speed = 0;
        }
      }
    }, {
      key: "initScrollBar",
      value: function initScrollBar() {
        this.scrollbar = document.createElement('span');
        this.scrollbarThumb = document.createElement('span');
        this.scrollbar.classList.add("".concat(this.scrollbarClass));
        this.scrollbarThumb.classList.add("".concat(this.scrollbarClass, "_thumb"));
        this.scrollbar.append(this.scrollbarThumb);

        if (this.scrollbarContainer) {
          this.scrollbarContainer.append(this.scrollbar);
        } else {
          document.body.append(this.scrollbar);
        } // Scrollbar Events


        this.getScrollBar = this.getScrollBar.bind(this);
        this.releaseScrollBar = this.releaseScrollBar.bind(this);
        this.moveScrollBar = this.moveScrollBar.bind(this);
        this.scrollbarThumb.addEventListener('mousedown', this.getScrollBar);
        window.addEventListener('mouseup', this.releaseScrollBar);
        window.addEventListener('mousemove', this.moveScrollBar); // Set scrollbar values

        this.hasScrollbar = false;

        if (this.direction == 'horizontal') {
          if (this.instance.limit.x + this.windowWidth <= this.windowWidth) {
            return;
          }
        } else {
          if (this.instance.limit.y + this.windowHeight <= this.windowHeight) {
            return;
          }
        }

        this.hasScrollbar = true;
        this.scrollbarBCR = this.scrollbar.getBoundingClientRect();
        this.scrollbarHeight = this.scrollbarBCR.height;
        this.scrollbarWidth = this.scrollbarBCR.width;

        if (this.direction === 'horizontal') {
          this.scrollbarThumb.style.width = "".concat(this.scrollbarWidth * this.scrollbarWidth / (this.instance.limit.x + this.scrollbarWidth), "px");
        } else {
          this.scrollbarThumb.style.height = "".concat(this.scrollbarHeight * this.scrollbarHeight / (this.instance.limit.y + this.scrollbarHeight), "px");
        }

        this.scrollbarThumbBCR = this.scrollbarThumb.getBoundingClientRect();
        this.scrollBarLimit = {
          x: this.scrollbarWidth - this.scrollbarThumbBCR.width,
          y: this.scrollbarHeight - this.scrollbarThumbBCR.height
        };
      }
    }, {
      key: "reinitScrollBar",
      value: function reinitScrollBar() {
        this.hasScrollbar = false;

        if (this.direction == 'horizontal') {
          if (this.instance.limit.x + this.windowWidth <= this.windowWidth) {
            return;
          }
        } else {
          if (this.instance.limit.y + this.windowHeight <= this.windowHeight) {
            return;
          }
        }

        this.hasScrollbar = true;
        this.scrollbarBCR = this.scrollbar.getBoundingClientRect();
        this.scrollbarHeight = this.scrollbarBCR.height;
        this.scrollbarWidth = this.scrollbarBCR.width;

        if (this.direction === 'horizontal') {
          this.scrollbarThumb.style.width = "".concat(this.scrollbarWidth * this.scrollbarWidth / (this.instance.limit.x + this.scrollbarWidth), "px");
        } else {
          this.scrollbarThumb.style.height = "".concat(this.scrollbarHeight * this.scrollbarHeight / (this.instance.limit.y + this.scrollbarHeight), "px");
        }

        this.scrollbarThumbBCR = this.scrollbarThumb.getBoundingClientRect();
        this.scrollBarLimit = {
          x: this.scrollbarWidth - this.scrollbarThumbBCR.width,
          y: this.scrollbarHeight - this.scrollbarThumbBCR.height
        };
      }
    }, {
      key: "destroyScrollBar",
      value: function destroyScrollBar() {
        this.scrollbarThumb.removeEventListener('mousedown', this.getScrollBar);
        window.removeEventListener('mouseup', this.releaseScrollBar);
        window.removeEventListener('mousemove', this.moveScrollBar);
        this.scrollbar.remove();
      }
    }, {
      key: "getScrollBar",
      value: function getScrollBar(e) {
        this.isDraggingScrollbar = true;
        this.checkScroll();
        this.html.classList.remove(this.scrollingClass);
        this.html.classList.add(this.draggingClass);
      }
    }, {
      key: "releaseScrollBar",
      value: function releaseScrollBar(e) {
        this.isDraggingScrollbar = false;

        if (this.isScrolling) {
          this.html.classList.add(this.scrollingClass);
        }

        this.html.classList.remove(this.draggingClass);
      }
    }, {
      key: "moveScrollBar",
      value: function moveScrollBar(e) {
        var _this5 = this;

        if (this.isDraggingScrollbar) {
          requestAnimationFrame(function () {
            var x = (e.clientX - _this5.scrollbarBCR.left) * 100 / _this5.scrollbarWidth * _this5.instance.limit.x / 100;
            var y = (e.clientY - _this5.scrollbarBCR.top) * 100 / _this5.scrollbarHeight * _this5.instance.limit.y / 100;

            if (y > 0 && y < _this5.instance.limit.y) {
              _this5.instance.delta.y = y;
            }

            if (x > 0 && x < _this5.instance.limit.x) {
              _this5.instance.delta.x = x;
            }
          });
        }
      }
    }, {
      key: "addElements",
      value: function addElements() {
        var _this6 = this;

        this.els = {};
        this.parallaxElements = {}; // this.sections.forEach((section, y) => {

        var els = this.el.querySelectorAll("[data-".concat(this.name, "]"));
        els.forEach(function (el, index) {
          // Try and find the target's parent section
          var targetParents = getParents(el);
          var section = Object.entries(_this6.sections).map(function (_ref3) {
            var _ref4 = _slicedToArray(_ref3, 2),
                key = _ref4[0],
                section = _ref4[1];

            return section;
          }).find(function (section) {
            return targetParents.includes(section.el);
          });
          var cl = el.dataset[_this6.name + 'Class'] || _this6["class"];
          var id = typeof el.dataset[_this6.name + 'Id'] === 'string' ? el.dataset[_this6.name + 'Id'] : 'el' + index;
          var top;
          var left;
          var repeat = el.dataset[_this6.name + 'Repeat'];
          var call = el.dataset[_this6.name + 'Call'];
          var position = el.dataset[_this6.name + 'Position'];
          var delay = el.dataset[_this6.name + 'Delay'];
          var direction = el.dataset[_this6.name + 'Direction'];
          var sticky = typeof el.dataset[_this6.name + 'Sticky'] === 'string';
          var speed = el.dataset[_this6.name + 'Speed'] ? parseFloat(el.dataset[_this6.name + 'Speed']) / 10 : false;
          var offset = typeof el.dataset[_this6.name + 'Offset'] === 'string' ? el.dataset[_this6.name + 'Offset'].split(',') : _this6.offset;
          var target = el.dataset[_this6.name + 'Target'];
          var targetEl;

          if (target !== undefined) {
            targetEl = document.querySelector("".concat(target));
          } else {
            targetEl = el;
          }

          var targetElBCR = targetEl.getBoundingClientRect();

          if (section === null) {
            top = targetElBCR.top + _this6.instance.scroll.y - getTranslate(targetEl).y;
            left = targetElBCR.left + _this6.instance.scroll.x - getTranslate(targetEl).x;
          } else {
            if (!section.inView) {
              top = targetElBCR.top - getTranslate(section.el).y - getTranslate(targetEl).y;
              left = targetElBCR.left - getTranslate(section.el).x - getTranslate(targetEl).x;
            } else {
              top = targetElBCR.top + _this6.instance.scroll.y - getTranslate(targetEl).y;
              left = targetElBCR.left + _this6.instance.scroll.x - getTranslate(targetEl).x;
            }
          }

          var bottom = top + targetEl.offsetHeight;
          var right = left + targetEl.offsetWidth;
          var middle = {
            x: (right - left) / 2 + left,
            y: (bottom - top) / 2 + top
          };

          if (sticky) {
            var elBCR = el.getBoundingClientRect();
            var elTop = elBCR.top;
            var elLeft = elBCR.left;
            var elDistance = {
              x: elLeft - left,
              y: elTop - top
            };
            top += window.innerHeight;
            left += window.innerWidth;
            bottom = elTop + targetEl.offsetHeight - el.offsetHeight - elDistance[_this6.directionAxis];
            right = elLeft + targetEl.offsetWidth - el.offsetWidth - elDistance[_this6.directionAxis];
            middle = {
              x: (right - left) / 2 + left,
              y: (bottom - top) / 2 + top
            };
          }

          if (repeat == 'false') {
            repeat = false;
          } else if (repeat != undefined) {
            repeat = true;
          } else {
            repeat = _this6.repeat;
          }

          var relativeOffset = [0, 0];

          if (offset) {
            if (_this6.direction === 'horizontal') {
              for (var i = 0; i < offset.length; i++) {
                if (typeof offset[i] == 'string') {
                  if (offset[i].includes('%')) {
                    relativeOffset[i] = parseInt(offset[i].replace('%', '') * _this6.windowWidth / 100);
                  } else {
                    relativeOffset[i] = parseInt(offset[i]);
                  }
                } else {
                  relativeOffset[i] = offset[i];
                }
              }

              left = left + relativeOffset[0];
              right = right - relativeOffset[1];
            } else {
              for (var i = 0; i < offset.length; i++) {
                if (typeof offset[i] == 'string') {
                  if (offset[i].includes('%')) {
                    relativeOffset[i] = parseInt(offset[i].replace('%', '') * _this6.windowHeight / 100);
                  } else {
                    relativeOffset[i] = parseInt(offset[i]);
                  }
                } else {
                  relativeOffset[i] = offset[i];
                }
              }

              top = top + relativeOffset[0];
              bottom = bottom - relativeOffset[1];
            }
          }

          var mappedEl = {
            el: el,
            id: id,
            "class": cl,
            section: section,
            top: top,
            middle: middle,
            bottom: bottom,
            left: left,
            right: right,
            offset: offset,
            progress: 0,
            repeat: repeat,
            inView: false,
            call: call,
            speed: speed,
            delay: delay,
            position: position,
            target: targetEl,
            direction: direction,
            sticky: sticky
          };
          _this6.els[id] = mappedEl;

          if (el.classList.contains(cl)) {
            _this6.setInView(_this6.els[id], id);
          }

          if (speed !== false || sticky) {
            _this6.parallaxElements[id] = mappedEl;
          }
        }); // });
      }
    }, {
      key: "addSections",
      value: function addSections() {
        var _this7 = this;

        this.sections = {};
        var sections = this.el.querySelectorAll("[data-".concat(this.name, "-section]"));

        if (sections.length === 0) {
          sections = [this.el];
        }

        sections.forEach(function (section, index) {
          var id = typeof section.dataset[_this7.name + 'Id'] === 'string' ? section.dataset[_this7.name + 'Id'] : 'section' + index;
          var sectionBCR = section.getBoundingClientRect();
          var offset = {
            x: sectionBCR.left - window.innerWidth * 1.5 - getTranslate(section).x,
            y: sectionBCR.top - window.innerHeight * 1.5 - getTranslate(section).y
          };
          var limit = {
            x: offset.x + sectionBCR.width + window.innerWidth * 2,
            y: offset.y + sectionBCR.height + window.innerHeight * 2
          };
          var persistent = typeof section.dataset[_this7.name + 'Persistent'] === 'string';
          section.setAttribute('data-scroll-section-id', id);
          var mappedSection = {
            el: section,
            offset: offset,
            limit: limit,
            inView: false,
            persistent: persistent,
            id: id
          };
          _this7.sections[id] = mappedSection;
        });
      }
    }, {
      key: "transform",
      value: function transform(element, x, y, delay) {
        var transform;

        if (!delay) {
          transform = "matrix3d(1,0,0.00,0,0.00,1,0.00,0,0,0,1,0,".concat(x, ",").concat(y, ",0,1)");
        } else {
          var start = getTranslate(element);
          var lerpX = lerp(start.x, x, delay);
          var lerpY = lerp(start.y, y, delay);
          transform = "matrix3d(1,0,0.00,0,0.00,1,0.00,0,0,0,1,0,".concat(lerpX, ",").concat(lerpY, ",0,1)");
        }

        element.style.webkitTransform = transform;
        element.style.msTransform = transform;
        element.style.transform = transform;
      }
    }, {
      key: "transformElements",
      value: function transformElements(isForced) {
        var _this8 = this;

        var setAllElements = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        var scrollRight = this.instance.scroll.x + this.windowWidth;
        var scrollBottom = this.instance.scroll.y + this.windowHeight;
        var scrollMiddle = {
          x: this.instance.scroll.x + this.windowMiddle.x,
          y: this.instance.scroll.y + this.windowMiddle.y
        };
        Object.entries(this.parallaxElements).forEach(function (_ref5) {
          var _ref6 = _slicedToArray(_ref5, 2),
              i = _ref6[0],
              current = _ref6[1];

          var transformDistance = false;

          if (isForced) {
            transformDistance = 0;
          }

          if (current.inView || setAllElements) {
            switch (current.position) {
              case 'top':
                transformDistance = _this8.instance.scroll[_this8.directionAxis] * -current.speed;
                break;

              case 'elementTop':
                transformDistance = (scrollBottom - current.top) * -current.speed;
                break;

              case 'bottom':
                transformDistance = (_this8.instance.limit[_this8.directionAxis] - scrollBottom + _this8.windowHeight) * current.speed;
                break;

              case 'left':
                transformDistance = _this8.instance.scroll[_this8.directionAxis] * -current.speed;
                break;

              case 'elementLeft':
                transformDistance = (scrollRight - current.left) * -current.speed;
                break;

              case 'right':
                transformDistance = (_this8.instance.limit[_this8.directionAxis] - scrollRight + _this8.windowHeight) * current.speed;
                break;

              default:
                transformDistance = (scrollMiddle[_this8.directionAxis] - current.middle[_this8.directionAxis]) * -current.speed;
                break;
            }
          }

          if (current.sticky) {
            if (current.inView) {
              if (_this8.direction === 'horizontal') {
                transformDistance = _this8.instance.scroll.x - current.left + window.innerWidth;
              } else {
                transformDistance = _this8.instance.scroll.y - current.top + window.innerHeight;
              }
            } else {
              if (_this8.direction === 'horizontal') {
                if (_this8.instance.scroll.x < current.left - window.innerWidth && _this8.instance.scroll.x < current.left - window.innerWidth / 2) {
                  transformDistance = 0;
                } else if (_this8.instance.scroll.x > current.right && _this8.instance.scroll.x > current.right + 100) {
                  transformDistance = current.right - current.left + window.innerWidth;
                } else {
                  transformDistance = false;
                }
              } else {
                if (_this8.instance.scroll.y < current.top - window.innerHeight && _this8.instance.scroll.y < current.top - window.innerHeight / 2) {
                  transformDistance = 0;
                } else if (_this8.instance.scroll.y > current.bottom && _this8.instance.scroll.y > current.bottom + 100) {
                  transformDistance = current.bottom - current.top + window.innerHeight;
                } else {
                  transformDistance = false;
                }
              }
            }
          }

          if (transformDistance !== false) {
            if (current.direction === 'horizontal' || _this8.direction === 'horizontal' && current.direction !== 'vertical') {
              _this8.transform(current.el, transformDistance, 0, isForced ? false : current.delay);
            } else {
              _this8.transform(current.el, 0, transformDistance, isForced ? false : current.delay);
            }
          }
        });
      }
      /**
       * Scroll to a desired target.
       *
       * @param  Available options :
       *          target {node, string, "top", "bottom", int} - The DOM element we want to scroll to
       *          options {object} - Options object for additionnal settings.
       * @return {void}
       */

    }, {
      key: "scrollTo",
      value: function scrollTo(target) {
        var _this9 = this;

        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // Parse options
        var offset = parseInt(options.offset) || 0; // An offset to apply on top of given `target` or `sourceElem`'s target

        var duration = !isNaN(parseInt(options.duration)) ? parseInt(options.duration) : 1000; // Duration of the scroll animation in milliseconds

        var easing = options.easing || [0.25, 0.0, 0.35, 1.0]; // An array of 4 floats between 0 and 1 defining the bezier curve for the animation's easing. See http://greweb.me/bezier-easing-editor/example/

        var disableLerp = options.disableLerp ? true : false; // Lerp effect won't be applied if set to true

        var callback = options.callback ? options.callback : false; // function called when scrollTo completes (note that it won't wait for lerp to stabilize)

        easing = src$1.apply(void 0, _toConsumableArray(easing));

        if (typeof target === 'string') {
          // Selector or boundaries
          if (target === 'top') {
            target = 0;
          } else if (target === 'bottom') {
            target = this.instance.limit.y;
          } else if (target === 'left') {
            target = 0;
          } else if (target === 'right') {
            target = this.instance.limit.x;
          } else {
            target = document.querySelector(target); // If the query fails, abort

            if (!target) {
              return;
            }
          }
        } else if (typeof target === 'number') {
          // Absolute coordinate
          target = parseInt(target);
        } else if (target && target.tagName) ; else {
          console.warn('`target` parameter is not valid');
          return;
        } // We have a target that is not a coordinate yet, get it


        if (typeof target !== 'number') {
          // Verify the given target belongs to this scroll scope
          var targetInScope = getParents(target).includes(this.el);

          if (!targetInScope) {
            // If the target isn't inside our main element, abort any action
            return;
          } // Get target offset from top


          var targetBCR = target.getBoundingClientRect();
          var offsetTop = targetBCR.top;
          var offsetLeft = targetBCR.left; // Try and find the target's parent section

          var targetParents = getParents(target);
          var parentSection = targetParents.find(function (candidate) {
            return Object.entries(_this9.sections) // Get sections associative array as a regular array
            .map(function (_ref7) {
              var _ref8 = _slicedToArray(_ref7, 2),
                  key = _ref8[0],
                  section = _ref8[1];

              return section;
            }) // map to section only (we dont need the key here)
            .find(function (section) {
              return section.el == candidate;
            }); // finally find the section that matches the candidate
          });
          var parentSectionOffset = 0;

          if (parentSection) {
            parentSectionOffset = getTranslate(parentSection)[this.directionAxis]; // We got a parent section, store it's current offset to remove it later
          } else {
            // if no parent section is found we need to use instance scroll directly
            parentSectionOffset = -this.instance.scroll[this.directionAxis];
          } // Final value of scroll destination : offsetTop + (optional offset given in options) - (parent's section translate)


          if (this.direction === 'horizontal') {
            offset = offsetLeft + offset - parentSectionOffset;
          } else {
            offset = offsetTop + offset - parentSectionOffset;
          }
        } else {
          offset = target + offset;
        } // Actual scrollto
        // ==========================================================================
        // Setup


        var scrollStart = parseFloat(this.instance.delta[this.directionAxis]);
        var scrollTarget = Math.max(0, Math.min(offset, this.instance.limit[this.directionAxis])); // Make sure our target is in the scroll boundaries

        var scrollDiff = scrollTarget - scrollStart;

        var render = function render(p) {
          if (disableLerp) {
            if (_this9.direction === 'horizontal') {
              _this9.setScroll(scrollStart + scrollDiff * p, _this9.instance.delta.y);
            } else {
              _this9.setScroll(_this9.instance.delta.x, scrollStart + scrollDiff * p);
            }
          } else {
            _this9.instance.delta[_this9.directionAxis] = scrollStart + scrollDiff * p;
          }
        }; // Prepare the scroll


        this.animatingScroll = true; // This boolean allows to prevent `checkScroll()` from calling `stopScrolling` when the animation is slow (i.e. at the beginning of an EaseIn)

        this.stopScrolling(); // Stop any movement, allows to kill any other `scrollTo` still happening

        this.startScrolling(); // Restart the scroll
        // Start the animation loop

        var start = Date.now();

        var loop = function loop() {
          var p = (Date.now() - start) / duration; // Animation progress

          if (p > 1) {
            // Animation ends
            render(1);
            _this9.animatingScroll = false;
            if (duration == 0) _this9.update();
            if (callback) callback();
          } else {
            _this9.scrollToRaf = requestAnimationFrame(loop);
            render(easing(p));
          }
        };

        loop();
      }
    }, {
      key: "update",
      value: function update() {
        this.setScrollLimit();
        this.addSections();
        this.addElements();
        this.detectElements();
        this.updateScroll();
        this.transformElements(true);
        this.reinitScrollBar();
        this.checkScroll(true);
      }
    }, {
      key: "startScroll",
      value: function startScroll() {
        this.stop = false;
      }
    }, {
      key: "stopScroll",
      value: function stopScroll() {
        this.stop = true;
      }
    }, {
      key: "setScroll",
      value: function setScroll(x, y) {
        this.instance = _objectSpread2(_objectSpread2({}, this.instance), {}, {
          scroll: {
            x: x,
            y: y
          },
          delta: {
            x: x,
            y: y
          },
          speed: 0
        });
      }
    }, {
      key: "destroy",
      value: function destroy() {
        _get(_getPrototypeOf(_default.prototype), "destroy", this).call(this);

        this.stopScrolling();
        this.html.classList.remove(this.smoothClass);
        this.vs.destroy();
        this.destroyScrollBar();
        window.removeEventListener('keydown', this.checkKey, false);
      }
    }]);

    return _default;
  }(_default);

  var Smooth = /*#__PURE__*/function () {
    function Smooth() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, Smooth);

      this.options = options; // Override default options with given ones

      Object.assign(this, defaults, options);
      this.smartphone = defaults.smartphone;
      if (options.smartphone) Object.assign(this.smartphone, options.smartphone);
      this.tablet = defaults.tablet;
      if (options.tablet) Object.assign(this.tablet, options.tablet);
      if (!this.smooth && this.direction == 'horizontal') console.warn('🚨 `smooth:false` & `horizontal` direction are not yet compatible');
      if (!this.tablet.smooth && this.tablet.direction == 'horizontal') console.warn('🚨 `smooth:false` & `horizontal` direction are not yet compatible (tablet)');
      if (!this.smartphone.smooth && this.smartphone.direction == 'horizontal') console.warn('🚨 `smooth:false` & `horizontal` direction are not yet compatible (smartphone)');
      this.init();
    }

    _createClass(Smooth, [{
      key: "init",
      value: function init() {
        this.options.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 || window.innerWidth < this.tablet.breakpoint;
        this.options.isTablet = this.options.isMobile && window.innerWidth >= this.tablet.breakpoint;

        if (this.smooth && !this.options.isMobile || this.tablet.smooth && this.options.isTablet || this.smartphone.smooth && this.options.isMobile && !this.options.isTablet) {
          this.scroll = new _default$2(this.options);
        } else {
          this.scroll = new _default$1(this.options);
        }

        this.scroll.init();

        if (window.location.hash) {
          // Get the hash without the '#' and find the matching element
          var id = window.location.hash.slice(1, window.location.hash.length);
          var target = document.getElementById(id); // If found, scroll to the element

          if (target) this.scroll.scrollTo(target);
        }
      }
    }, {
      key: "update",
      value: function update() {
        this.scroll.update();
      }
    }, {
      key: "start",
      value: function start() {
        this.scroll.startScroll();
      }
    }, {
      key: "stop",
      value: function stop() {
        this.scroll.stopScroll();
      }
    }, {
      key: "scrollTo",
      value: function scrollTo(target, options) {
        this.scroll.scrollTo(target, options);
      }
    }, {
      key: "setScroll",
      value: function setScroll(x, y) {
        this.scroll.setScroll(x, y);
      }
    }, {
      key: "on",
      value: function on(event, func) {
        this.scroll.setEvents(event, func);
      }
    }, {
      key: "off",
      value: function off(event, func) {
        this.scroll.unsetEvents(event, func);
      }
    }, {
      key: "destroy",
      value: function destroy() {
        this.scroll.destroy();
      }
    }]);

    return Smooth;
  }();

  class InputPhone {
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

  const validationMessages = {

  	valueMissing: {
  	 default: 'Заполните поле',
  	},

  	typeMismatch: {
  	 email: 'Проверьте адрес электронной почты',
  	 phone: 'Укажите номер телефона',
  	}

  };

  class Input {
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

  function _typeof(obj) {
    "@babel/helpers - typeof";

    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  function _classCallCheck$1(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties$1(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass$1(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties$1(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties$1(Constructor, staticProps);
    return Constructor;
  }

  function _defineProperty$1(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function _inherits$1(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function");
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        writable: true,
        configurable: true
      }
    });
    if (superClass) _setPrototypeOf$1(subClass, superClass);
  }

  function _getPrototypeOf$1(o) {
    _getPrototypeOf$1 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
      return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _getPrototypeOf$1(o);
  }

  function _setPrototypeOf$1(o, p) {
    _setPrototypeOf$1 = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };

    return _setPrototypeOf$1(o, p);
  }

  function _isNativeReflectConstruct$1() {
    if (typeof Reflect === "undefined" || !Reflect.construct) return false;
    if (Reflect.construct.sham) return false;
    if (typeof Proxy === "function") return true;

    try {
      Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
      return true;
    } catch (e) {
      return false;
    }
  }

  function _objectWithoutPropertiesLoose(source, excluded) {
    if (source == null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key, i;

    for (i = 0; i < sourceKeys.length; i++) {
      key = sourceKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      target[key] = source[key];
    }

    return target;
  }

  function _objectWithoutProperties(source, excluded) {
    if (source == null) return {};

    var target = _objectWithoutPropertiesLoose(source, excluded);

    var key, i;

    if (Object.getOwnPropertySymbols) {
      var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

      for (i = 0; i < sourceSymbolKeys.length; i++) {
        key = sourceSymbolKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
        target[key] = source[key];
      }
    }

    return target;
  }

  function _assertThisInitialized$1(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return self;
  }

  function _possibleConstructorReturn$1(self, call) {
    if (call && (typeof call === "object" || typeof call === "function")) {
      return call;
    } else if (call !== void 0) {
      throw new TypeError("Derived constructors may only return object or undefined");
    }

    return _assertThisInitialized$1(self);
  }

  function _createSuper$1(Derived) {
    var hasNativeReflectConstruct = _isNativeReflectConstruct$1();

    return function _createSuperInternal() {
      var Super = _getPrototypeOf$1(Derived),
          result;

      if (hasNativeReflectConstruct) {
        var NewTarget = _getPrototypeOf$1(this).constructor;

        result = Reflect.construct(Super, arguments, NewTarget);
      } else {
        result = Super.apply(this, arguments);
      }

      return _possibleConstructorReturn$1(this, result);
    };
  }

  function _superPropBase$1(object, property) {
    while (!Object.prototype.hasOwnProperty.call(object, property)) {
      object = _getPrototypeOf$1(object);
      if (object === null) break;
    }

    return object;
  }

  function _get$1(target, property, receiver) {
    if (typeof Reflect !== "undefined" && Reflect.get) {
      _get$1 = Reflect.get;
    } else {
      _get$1 = function _get(target, property, receiver) {
        var base = _superPropBase$1(target, property);

        if (!base) return;
        var desc = Object.getOwnPropertyDescriptor(base, property);

        if (desc.get) {
          return desc.get.call(receiver);
        }

        return desc.value;
      };
    }

    return _get$1(target, property, receiver || target);
  }

  function set(target, property, value, receiver) {
    if (typeof Reflect !== "undefined" && Reflect.set) {
      set = Reflect.set;
    } else {
      set = function set(target, property, value, receiver) {
        var base = _superPropBase$1(target, property);

        var desc;

        if (base) {
          desc = Object.getOwnPropertyDescriptor(base, property);

          if (desc.set) {
            desc.set.call(receiver, value);
            return true;
          } else if (!desc.writable) {
            return false;
          }
        }

        desc = Object.getOwnPropertyDescriptor(receiver, property);

        if (desc) {
          if (!desc.writable) {
            return false;
          }

          desc.value = value;
          Object.defineProperty(receiver, property, desc);
        } else {
          _defineProperty$1(receiver, property, value);
        }

        return true;
      };
    }

    return set(target, property, value, receiver);
  }

  function _set(target, property, value, receiver, isStrict) {
    var s = set(target, property, value, receiver || target);

    if (!s && isStrict) {
      throw new Error('failed to set property');
    }

    return value;
  }

  function _slicedToArray$1(arr, i) {
    return _arrayWithHoles$1(arr) || _iterableToArrayLimit$1(arr, i) || _unsupportedIterableToArray$1(arr, i) || _nonIterableRest$1();
  }

  function _arrayWithHoles$1(arr) {
    if (Array.isArray(arr)) return arr;
  }

  function _iterableToArrayLimit$1(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];

    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;

    var _s, _e;

    try {
      for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  function _unsupportedIterableToArray$1(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray$1(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$1(o, minLen);
  }

  function _arrayLikeToArray$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;

    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

    return arr2;
  }

  function _nonIterableRest$1() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  /** Checks if value is string */
  function isString(str) {
    return typeof str === 'string' || str instanceof String;
  }
  /**
    Direction
    @prop {string} NONE
    @prop {string} LEFT
    @prop {string} FORCE_LEFT
    @prop {string} RIGHT
    @prop {string} FORCE_RIGHT
  */

  var DIRECTION = {
    NONE: 'NONE',
    LEFT: 'LEFT',
    FORCE_LEFT: 'FORCE_LEFT',
    RIGHT: 'RIGHT',
    FORCE_RIGHT: 'FORCE_RIGHT'
  };
  /** */

  function forceDirection(direction) {
    switch (direction) {
      case DIRECTION.LEFT:
        return DIRECTION.FORCE_LEFT;

      case DIRECTION.RIGHT:
        return DIRECTION.FORCE_RIGHT;

      default:
        return direction;
    }
  }
  /** Escapes regular expression control chars */

  function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
  } // cloned from https://github.com/epoberezkin/fast-deep-equal with small changes

  function objectIncludes(b, a) {
    if (a === b) return true;
    var arrA = Array.isArray(a),
        arrB = Array.isArray(b),
        i;

    if (arrA && arrB) {
      if (a.length != b.length) return false;

      for (i = 0; i < a.length; i++) {
        if (!objectIncludes(a[i], b[i])) return false;
      }

      return true;
    }

    if (arrA != arrB) return false;

    if (a && b && _typeof(a) === 'object' && _typeof(b) === 'object') {
      var dateA = a instanceof Date,
          dateB = b instanceof Date;
      if (dateA && dateB) return a.getTime() == b.getTime();
      if (dateA != dateB) return false;
      var regexpA = a instanceof RegExp,
          regexpB = b instanceof RegExp;
      if (regexpA && regexpB) return a.toString() == b.toString();
      if (regexpA != regexpB) return false;
      var keys = Object.keys(a); // if (keys.length !== Object.keys(b).length) return false;

      for (i = 0; i < keys.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
      }

      for (i = 0; i < keys.length; i++) {
        if (!objectIncludes(b[keys[i]], a[keys[i]])) return false;
      }

      return true;
    } else if (a && b && typeof a === 'function' && typeof b === 'function') {
      return a.toString() === b.toString();
    }

    return false;
  }

  /** Provides details of changing input */

  var ActionDetails = /*#__PURE__*/function () {
    /** Current input value */

    /** Current cursor position */

    /** Old input value */

    /** Old selection */
    function ActionDetails(value, cursorPos, oldValue, oldSelection) {
      _classCallCheck$1(this, ActionDetails);

      this.value = value;
      this.cursorPos = cursorPos;
      this.oldValue = oldValue;
      this.oldSelection = oldSelection; // double check if left part was changed (autofilling, other non-standard input triggers)

      while (this.value.slice(0, this.startChangePos) !== this.oldValue.slice(0, this.startChangePos)) {
        --this.oldSelection.start;
      }
    }
    /**
      Start changing position
      @readonly
    */


    _createClass$1(ActionDetails, [{
      key: "startChangePos",
      get: function get() {
        return Math.min(this.cursorPos, this.oldSelection.start);
      }
      /**
        Inserted symbols count
        @readonly
      */

    }, {
      key: "insertedCount",
      get: function get() {
        return this.cursorPos - this.startChangePos;
      }
      /**
        Inserted symbols
        @readonly
      */

    }, {
      key: "inserted",
      get: function get() {
        return this.value.substr(this.startChangePos, this.insertedCount);
      }
      /**
        Removed symbols count
        @readonly
      */

    }, {
      key: "removedCount",
      get: function get() {
        // Math.max for opposite operation
        return Math.max(this.oldSelection.end - this.startChangePos || // for Delete
        this.oldValue.length - this.value.length, 0);
      }
      /**
        Removed symbols
        @readonly
      */

    }, {
      key: "removed",
      get: function get() {
        return this.oldValue.substr(this.startChangePos, this.removedCount);
      }
      /**
        Unchanged head symbols
        @readonly
      */

    }, {
      key: "head",
      get: function get() {
        return this.value.substring(0, this.startChangePos);
      }
      /**
        Unchanged tail symbols
        @readonly
      */

    }, {
      key: "tail",
      get: function get() {
        return this.value.substring(this.startChangePos + this.insertedCount);
      }
      /**
        Remove direction
        @readonly
      */

    }, {
      key: "removeDirection",
      get: function get() {
        if (!this.removedCount || this.insertedCount) return DIRECTION.NONE; // align right if delete at right or if range removed (event with backspace)

        return this.oldSelection.end === this.cursorPos || this.oldSelection.start === this.cursorPos ? DIRECTION.RIGHT : DIRECTION.LEFT;
      }
    }]);

    return ActionDetails;
  }();

  /**
    Provides details of changing model value
    @param {Object} [details]
    @param {string} [details.inserted] - Inserted symbols
    @param {boolean} [details.skip] - Can skip chars
    @param {number} [details.removeCount] - Removed symbols count
    @param {number} [details.tailShift] - Additional offset if any changes occurred before tail
  */
  var ChangeDetails = /*#__PURE__*/function () {
    /** Inserted symbols */

    /** Can skip chars */

    /** Additional offset if any changes occurred before tail */

    /** Raw inserted is used by dynamic mask */
    function ChangeDetails(details) {
      _classCallCheck$1(this, ChangeDetails);

      Object.assign(this, {
        inserted: '',
        rawInserted: '',
        skip: false,
        tailShift: 0
      }, details);
    }
    /**
      Aggregate changes
      @returns {ChangeDetails} `this`
    */


    _createClass$1(ChangeDetails, [{
      key: "aggregate",
      value: function aggregate(details) {
        this.rawInserted += details.rawInserted;
        this.skip = this.skip || details.skip;
        this.inserted += details.inserted;
        this.tailShift += details.tailShift;
        return this;
      }
      /** Total offset considering all changes */

    }, {
      key: "offset",
      get: function get() {
        return this.tailShift + this.inserted.length;
      }
    }]);

    return ChangeDetails;
  }();

  /** Provides details of continuous extracted tail */
  var ContinuousTailDetails = /*#__PURE__*/function () {
    /** Tail value as string */

    /** Tail start position */

    /** Start position */
    function ContinuousTailDetails() {
      var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      var from = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      var stop = arguments.length > 2 ? arguments[2] : undefined;

      _classCallCheck$1(this, ContinuousTailDetails);

      this.value = value;
      this.from = from;
      this.stop = stop;
    }

    _createClass$1(ContinuousTailDetails, [{
      key: "toString",
      value: function toString() {
        return this.value;
      }
    }, {
      key: "extend",
      value: function extend(tail) {
        this.value += String(tail);
      }
    }, {
      key: "appendTo",
      value: function appendTo(masked) {
        return masked.append(this.toString(), {
          tail: true
        }).aggregate(masked._appendPlaceholder());
      }
    }, {
      key: "state",
      get: function get() {
        return {
          value: this.value,
          from: this.from,
          stop: this.stop
        };
      },
      set: function set(state) {
        Object.assign(this, state);
      }
    }, {
      key: "shiftBefore",
      value: function shiftBefore(pos) {
        if (this.from >= pos || !this.value.length) return '';
        var shiftChar = this.value[0];
        this.value = this.value.slice(1);
        return shiftChar;
      }
    }]);

    return ContinuousTailDetails;
  }();

  /**
   * Applies mask on element.
   * @constructor
   * @param {HTMLInputElement|HTMLTextAreaElement|MaskElement} el - Element to apply mask
   * @param {Object} opts - Custom mask options
   * @return {InputMask}
   */
  function IMask$1(el) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    // currently available only for input-like elements
    return new IMask$1.InputMask(el, opts);
  }

  /** Supported mask type */

  /** Provides common masking stuff */
  var Masked = /*#__PURE__*/function () {
    // $Shape<MaskedOptions>; TODO after fix https://github.com/facebook/flow/issues/4773

    /** @type {Mask} */

    /** */
    // $FlowFixMe no ideas

    /** Transforms value before mask processing */

    /** Validates if value is acceptable */

    /** Does additional processing in the end of editing */

    /** Format typed value to string */

    /** Parse strgin to get typed value */

    /** Enable characters overwriting */

    /** */
    function Masked(opts) {
      _classCallCheck$1(this, Masked);

      this._value = '';

      this._update(Object.assign({}, Masked.DEFAULTS, opts));

      this.isInitialized = true;
    }
    /** Sets and applies new options */


    _createClass$1(Masked, [{
      key: "updateOptions",
      value: function updateOptions(opts) {
        if (!Object.keys(opts).length) return;
        this.withValueRefresh(this._update.bind(this, opts));
      }
      /**
        Sets new options
        @protected
      */

    }, {
      key: "_update",
      value: function _update(opts) {
        Object.assign(this, opts);
      }
      /** Mask state */

    }, {
      key: "state",
      get: function get() {
        return {
          _value: this.value
        };
      },
      set: function set(state) {
        this._value = state._value;
      }
      /** Resets value */

    }, {
      key: "reset",
      value: function reset() {
        this._value = '';
      }
      /** */

    }, {
      key: "value",
      get: function get() {
        return this._value;
      },
      set: function set(value) {
        this.resolve(value);
      }
      /** Resolve new value */

    }, {
      key: "resolve",
      value: function resolve(value) {
        this.reset();
        this.append(value, {
          input: true
        }, '');
        this.doCommit();
        return this.value;
      }
      /** */

    }, {
      key: "unmaskedValue",
      get: function get() {
        return this.value;
      },
      set: function set(value) {
        this.reset();
        this.append(value, {}, '');
        this.doCommit();
      }
      /** */

    }, {
      key: "typedValue",
      get: function get() {
        return this.doParse(this.value);
      },
      set: function set(value) {
        this.value = this.doFormat(value);
      }
      /** Value that includes raw user input */

    }, {
      key: "rawInputValue",
      get: function get() {
        return this.extractInput(0, this.value.length, {
          raw: true
        });
      },
      set: function set(value) {
        this.reset();
        this.append(value, {
          raw: true
        }, '');
        this.doCommit();
      }
      /** */

    }, {
      key: "isComplete",
      get: function get() {
        return true;
      }
      /** Finds nearest input position in direction */

    }, {
      key: "nearestInputPos",
      value: function nearestInputPos(cursorPos, direction) {
        return cursorPos;
      }
      /** Extracts value in range considering flags */

    }, {
      key: "extractInput",
      value: function extractInput() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        return this.value.slice(fromPos, toPos);
      }
      /** Extracts tail in range */

    }, {
      key: "extractTail",
      value: function extractTail() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        return new ContinuousTailDetails(this.extractInput(fromPos, toPos), fromPos);
      }
      /** Appends tail */
      // $FlowFixMe no ideas

    }, {
      key: "appendTail",
      value: function appendTail(tail) {
        if (isString(tail)) tail = new ContinuousTailDetails(String(tail));
        return tail.appendTo(this);
      }
      /** Appends char */

    }, {
      key: "_appendCharRaw",
      value: function _appendCharRaw(ch) {
        if (!ch) return new ChangeDetails();
        this._value += ch;
        return new ChangeDetails({
          inserted: ch,
          rawInserted: ch
        });
      }
      /** Appends char */

    }, {
      key: "_appendChar",
      value: function _appendChar(ch) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var checkTail = arguments.length > 2 ? arguments[2] : undefined;
        var consistentState = this.state;

        var details = this._appendCharRaw(this.doPrepare(ch, flags), flags);

        if (details.inserted) {
          var consistentTail;
          var appended = this.doValidate(flags) !== false;

          if (appended && checkTail != null) {
            // validation ok, check tail
            var beforeTailState = this.state;

            if (this.overwrite) {
              consistentTail = checkTail.state;
              checkTail.shiftBefore(this.value.length);
            }

            var tailDetails = this.appendTail(checkTail);
            appended = tailDetails.rawInserted === checkTail.toString(); // if ok, rollback state after tail

            if (appended && tailDetails.inserted) this.state = beforeTailState;
          } // revert all if something went wrong


          if (!appended) {
            details = new ChangeDetails();
            this.state = consistentState;
            if (checkTail && consistentTail) checkTail.state = consistentTail;
          }
        }

        return details;
      }
      /** Appends optional placeholder at end */

    }, {
      key: "_appendPlaceholder",
      value: function _appendPlaceholder() {
        return new ChangeDetails();
      }
      /** Appends symbols considering flags */
      // $FlowFixMe no ideas

    }, {
      key: "append",
      value: function append(str, flags, tail) {
        if (!isString(str)) throw new Error('value should be string');
        var details = new ChangeDetails();
        var checkTail = isString(tail) ? new ContinuousTailDetails(String(tail)) : tail;
        if (flags && flags.tail) flags._beforeTailState = this.state;

        for (var ci = 0; ci < str.length; ++ci) {
          details.aggregate(this._appendChar(str[ci], flags, checkTail));
        } // append tail but aggregate only tailShift


        if (checkTail != null) {
          details.tailShift += this.appendTail(checkTail).tailShift; // TODO it's a good idea to clear state after appending ends
          // but it causes bugs when one append calls another (when dynamic dispatch set rawInputValue)
          // this._resetBeforeTailState();
        }

        return details;
      }
      /** */

    }, {
      key: "remove",
      value: function remove() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        this._value = this.value.slice(0, fromPos) + this.value.slice(toPos);
        return new ChangeDetails();
      }
      /** Calls function and reapplies current value */

    }, {
      key: "withValueRefresh",
      value: function withValueRefresh(fn) {
        if (this._refreshing || !this.isInitialized) return fn();
        this._refreshing = true;
        var rawInput = this.rawInputValue;
        var value = this.value;
        var ret = fn();
        this.rawInputValue = rawInput; // append lost trailing chars at end

        if (this.value && this.value !== value && value.indexOf(this.value) === 0) {
          this.append(value.slice(this.value.length), {}, '');
        }

        delete this._refreshing;
        return ret;
      }
      /** */

    }, {
      key: "runIsolated",
      value: function runIsolated(fn) {
        if (this._isolated || !this.isInitialized) return fn(this);
        this._isolated = true;
        var state = this.state;
        var ret = fn(this);
        this.state = state;
        delete this._isolated;
        return ret;
      }
      /**
        Prepares string before mask processing
        @protected
      */

    }, {
      key: "doPrepare",
      value: function doPrepare(str) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        return this.prepare ? this.prepare(str, this, flags) : str;
      }
      /**
        Validates if value is acceptable
        @protected
      */

    }, {
      key: "doValidate",
      value: function doValidate(flags) {
        return (!this.validate || this.validate(this.value, this, flags)) && (!this.parent || this.parent.doValidate(flags));
      }
      /**
        Does additional processing in the end of editing
        @protected
      */

    }, {
      key: "doCommit",
      value: function doCommit() {
        if (this.commit) this.commit(this.value, this);
      }
      /** */

    }, {
      key: "doFormat",
      value: function doFormat(value) {
        return this.format ? this.format(value, this) : value;
      }
      /** */

    }, {
      key: "doParse",
      value: function doParse(str) {
        return this.parse ? this.parse(str, this) : str;
      }
      /** */

    }, {
      key: "splice",
      value: function splice(start, deleteCount, inserted, removeDirection) {
        var tailPos = start + deleteCount;
        var tail = this.extractTail(tailPos);
        var startChangePos = this.nearestInputPos(start, removeDirection);
        var changeDetails = new ChangeDetails({
          tailShift: startChangePos - start // adjust tailShift if start was aligned

        }).aggregate(this.remove(startChangePos)).aggregate(this.append(inserted, {
          input: true
        }, tail));
        return changeDetails;
      }
    }]);

    return Masked;
  }();
  Masked.DEFAULTS = {
    format: function format(v) {
      return v;
    },
    parse: function parse(v) {
      return v;
    }
  };
  IMask$1.Masked = Masked;

  /** Get Masked class by mask type */

  function maskedClass(mask) {
    if (mask == null) {
      throw new Error('mask property should be defined');
    } // $FlowFixMe


    if (mask instanceof RegExp) return IMask$1.MaskedRegExp; // $FlowFixMe

    if (isString(mask)) return IMask$1.MaskedPattern; // $FlowFixMe

    if (mask instanceof Date || mask === Date) return IMask$1.MaskedDate; // $FlowFixMe

    if (mask instanceof Number || typeof mask === 'number' || mask === Number) return IMask$1.MaskedNumber; // $FlowFixMe

    if (Array.isArray(mask) || mask === Array) return IMask$1.MaskedDynamic; // $FlowFixMe

    if (IMask$1.Masked && mask.prototype instanceof IMask$1.Masked) return mask; // $FlowFixMe

    if (mask instanceof Function) return IMask$1.MaskedFunction; // $FlowFixMe

    if (mask instanceof IMask$1.Masked) return mask.constructor;
    console.warn('Mask not found for mask', mask); // eslint-disable-line no-console
    // $FlowFixMe

    return IMask$1.Masked;
  }
  /** Creates new {@link Masked} depending on mask type */

  function createMask(opts) {
    // $FlowFixMe
    if (IMask$1.Masked && opts instanceof IMask$1.Masked) return opts;
    opts = Object.assign({}, opts);
    var mask = opts.mask; // $FlowFixMe

    if (IMask$1.Masked && mask instanceof IMask$1.Masked) return mask;
    var MaskedClass = maskedClass(mask);
    if (!MaskedClass) throw new Error('Masked class is not found for provided mask, appropriate module needs to be import manually before creating mask.');
    return new MaskedClass(opts);
  }
  IMask$1.createMask = createMask;

  var _excluded = ["mask"];
  var DEFAULT_INPUT_DEFINITIONS = {
    '0': /\d/,
    'a': /[\u0041-\u005A\u0061-\u007A\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/,
    // http://stackoverflow.com/a/22075070
    '*': /./
  };
  /** */

  var PatternInputDefinition = /*#__PURE__*/function () {
    /** */

    /** */

    /** */

    /** */

    /** */

    /** */
    function PatternInputDefinition(opts) {
      _classCallCheck$1(this, PatternInputDefinition);

      var mask = opts.mask,
          blockOpts = _objectWithoutProperties(opts, _excluded);

      this.masked = createMask({
        mask: mask
      });
      Object.assign(this, blockOpts);
    }

    _createClass$1(PatternInputDefinition, [{
      key: "reset",
      value: function reset() {
        this._isFilled = false;
        this.masked.reset();
      }
    }, {
      key: "remove",
      value: function remove() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;

        if (fromPos === 0 && toPos >= 1) {
          this._isFilled = false;
          return this.masked.remove(fromPos, toPos);
        }

        return new ChangeDetails();
      }
    }, {
      key: "value",
      get: function get() {
        return this.masked.value || (this._isFilled && !this.isOptional ? this.placeholderChar : '');
      }
    }, {
      key: "unmaskedValue",
      get: function get() {
        return this.masked.unmaskedValue;
      }
    }, {
      key: "isComplete",
      get: function get() {
        return Boolean(this.masked.value) || this.isOptional;
      }
    }, {
      key: "_appendChar",
      value: function _appendChar(str) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (this._isFilled) return new ChangeDetails();
        var state = this.masked.state; // simulate input

        var details = this.masked._appendChar(str, flags);

        if (details.inserted && this.doValidate(flags) === false) {
          details.inserted = details.rawInserted = '';
          this.masked.state = state;
        }

        if (!details.inserted && !this.isOptional && !this.lazy && !flags.input) {
          details.inserted = this.placeholderChar;
        }

        details.skip = !details.inserted && !this.isOptional;
        this._isFilled = Boolean(details.inserted);
        return details;
      }
    }, {
      key: "append",
      value: function append() {
        var _this$masked;

        return (_this$masked = this.masked).append.apply(_this$masked, arguments);
      }
    }, {
      key: "_appendPlaceholder",
      value: function _appendPlaceholder() {
        var details = new ChangeDetails();
        if (this._isFilled || this.isOptional) return details;
        this._isFilled = true;
        details.inserted = this.placeholderChar;
        return details;
      }
    }, {
      key: "extractTail",
      value: function extractTail() {
        var _this$masked2;

        return (_this$masked2 = this.masked).extractTail.apply(_this$masked2, arguments);
      }
    }, {
      key: "appendTail",
      value: function appendTail() {
        var _this$masked3;

        return (_this$masked3 = this.masked).appendTail.apply(_this$masked3, arguments);
      }
    }, {
      key: "extractInput",
      value: function extractInput() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        var flags = arguments.length > 2 ? arguments[2] : undefined;
        return this.masked.extractInput(fromPos, toPos, flags);
      }
    }, {
      key: "nearestInputPos",
      value: function nearestInputPos(cursorPos) {
        var direction = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DIRECTION.NONE;
        var minPos = 0;
        var maxPos = this.value.length;
        var boundPos = Math.min(Math.max(cursorPos, minPos), maxPos);

        switch (direction) {
          case DIRECTION.LEFT:
          case DIRECTION.FORCE_LEFT:
            return this.isComplete ? boundPos : minPos;

          case DIRECTION.RIGHT:
          case DIRECTION.FORCE_RIGHT:
            return this.isComplete ? boundPos : maxPos;

          case DIRECTION.NONE:
          default:
            return boundPos;
        }
      }
    }, {
      key: "doValidate",
      value: function doValidate() {
        var _this$masked4, _this$parent;

        return (_this$masked4 = this.masked).doValidate.apply(_this$masked4, arguments) && (!this.parent || (_this$parent = this.parent).doValidate.apply(_this$parent, arguments));
      }
    }, {
      key: "doCommit",
      value: function doCommit() {
        this.masked.doCommit();
      }
    }, {
      key: "state",
      get: function get() {
        return {
          masked: this.masked.state,
          _isFilled: this._isFilled
        };
      },
      set: function set(state) {
        this.masked.state = state.masked;
        this._isFilled = state._isFilled;
      }
    }]);

    return PatternInputDefinition;
  }();

  var PatternFixedDefinition = /*#__PURE__*/function () {
    /** */

    /** */

    /** */

    /** */
    function PatternFixedDefinition(opts) {
      _classCallCheck$1(this, PatternFixedDefinition);

      Object.assign(this, opts);
      this._value = '';
    }

    _createClass$1(PatternFixedDefinition, [{
      key: "value",
      get: function get() {
        return this._value;
      }
    }, {
      key: "unmaskedValue",
      get: function get() {
        return this.isUnmasking ? this.value : '';
      }
    }, {
      key: "reset",
      value: function reset() {
        this._isRawInput = false;
        this._value = '';
      }
    }, {
      key: "remove",
      value: function remove() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this._value.length;
        this._value = this._value.slice(0, fromPos) + this._value.slice(toPos);
        if (!this._value) this._isRawInput = false;
        return new ChangeDetails();
      }
    }, {
      key: "nearestInputPos",
      value: function nearestInputPos(cursorPos) {
        var direction = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DIRECTION.NONE;
        var minPos = 0;
        var maxPos = this._value.length;

        switch (direction) {
          case DIRECTION.LEFT:
          case DIRECTION.FORCE_LEFT:
            return minPos;

          case DIRECTION.NONE:
          case DIRECTION.RIGHT:
          case DIRECTION.FORCE_RIGHT:
          default:
            return maxPos;
        }
      }
    }, {
      key: "extractInput",
      value: function extractInput() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this._value.length;
        var flags = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        return flags.raw && this._isRawInput && this._value.slice(fromPos, toPos) || '';
      }
    }, {
      key: "isComplete",
      get: function get() {
        return true;
      }
    }, {
      key: "_appendChar",
      value: function _appendChar(str) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var details = new ChangeDetails();
        if (this._value) return details;
        var appended = this.char === str[0];
        var isResolved = appended && (this.isUnmasking || flags.input || flags.raw) && !flags.tail;
        if (isResolved) details.rawInserted = this.char;
        this._value = details.inserted = this.char;
        this._isRawInput = isResolved && (flags.raw || flags.input);
        return details;
      }
    }, {
      key: "_appendPlaceholder",
      value: function _appendPlaceholder() {
        var details = new ChangeDetails();
        if (this._value) return details;
        this._value = details.inserted = this.char;
        return details;
      }
    }, {
      key: "extractTail",
      value: function extractTail() {
        arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        return new ContinuousTailDetails('');
      } // $FlowFixMe no ideas

    }, {
      key: "appendTail",
      value: function appendTail(tail) {
        if (isString(tail)) tail = new ContinuousTailDetails(String(tail));
        return tail.appendTo(this);
      }
    }, {
      key: "append",
      value: function append(str, flags, tail) {
        var details = this._appendChar(str, flags);

        if (tail != null) {
          details.tailShift += this.appendTail(tail).tailShift;
        }

        return details;
      }
    }, {
      key: "doCommit",
      value: function doCommit() {}
    }, {
      key: "state",
      get: function get() {
        return {
          _value: this._value,
          _isRawInput: this._isRawInput
        };
      },
      set: function set(state) {
        Object.assign(this, state);
      }
    }]);

    return PatternFixedDefinition;
  }();

  var _excluded$1 = ["chunks"];

  var ChunksTailDetails = /*#__PURE__*/function () {
    /** */
    function ChunksTailDetails() {
      var chunks = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      var from = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

      _classCallCheck$1(this, ChunksTailDetails);

      this.chunks = chunks;
      this.from = from;
    }

    _createClass$1(ChunksTailDetails, [{
      key: "toString",
      value: function toString() {
        return this.chunks.map(String).join('');
      } // $FlowFixMe no ideas

    }, {
      key: "extend",
      value: function extend(tailChunk) {
        if (!String(tailChunk)) return;
        if (isString(tailChunk)) tailChunk = new ContinuousTailDetails(String(tailChunk));
        var lastChunk = this.chunks[this.chunks.length - 1];
        var extendLast = lastChunk && (lastChunk.stop === tailChunk.stop || tailChunk.stop == null) && // if tail chunk goes just after last chunk
        tailChunk.from === lastChunk.from + lastChunk.toString().length;

        if (tailChunk instanceof ContinuousTailDetails) {
          // check the ability to extend previous chunk
          if (extendLast) {
            // extend previous chunk
            lastChunk.extend(tailChunk.toString());
          } else {
            // append new chunk
            this.chunks.push(tailChunk);
          }
        } else if (tailChunk instanceof ChunksTailDetails) {
          if (tailChunk.stop == null) {
            // unwrap floating chunks to parent, keeping `from` pos
            var firstTailChunk;

            while (tailChunk.chunks.length && tailChunk.chunks[0].stop == null) {
              firstTailChunk = tailChunk.chunks.shift();
              firstTailChunk.from += tailChunk.from;
              this.extend(firstTailChunk);
            }
          } // if tail chunk still has value


          if (tailChunk.toString()) {
            // if chunks contains stops, then popup stop to container
            tailChunk.stop = tailChunk.blockIndex;
            this.chunks.push(tailChunk);
          }
        }
      }
    }, {
      key: "appendTo",
      value: function appendTo(masked) {
        // $FlowFixMe
        if (!(masked instanceof IMask$1.MaskedPattern)) {
          var tail = new ContinuousTailDetails(this.toString());
          return tail.appendTo(masked);
        }

        var details = new ChangeDetails();

        for (var ci = 0; ci < this.chunks.length && !details.skip; ++ci) {
          var chunk = this.chunks[ci];

          var lastBlockIter = masked._mapPosToBlock(masked.value.length);

          var stop = chunk.stop;
          var chunkBlock = void 0;

          if (stop != null && (!lastBlockIter || lastBlockIter.index <= stop)) {
            if (chunk instanceof ChunksTailDetails || // for continuous block also check if stop is exist
            masked._stops.indexOf(stop) >= 0) {
              details.aggregate(masked._appendPlaceholder(stop));
            }

            chunkBlock = chunk instanceof ChunksTailDetails && masked._blocks[stop];
          }

          if (chunkBlock) {
            var tailDetails = chunkBlock.appendTail(chunk);
            tailDetails.skip = false; // always ignore skip, it will be set on last

            details.aggregate(tailDetails);
            masked._value += tailDetails.inserted; // get not inserted chars

            var remainChars = chunk.toString().slice(tailDetails.rawInserted.length);
            if (remainChars) details.aggregate(masked.append(remainChars, {
              tail: true
            }));
          } else {
            details.aggregate(masked.append(chunk.toString(), {
              tail: true
            }));
          }
        }
        return details;
      }
    }, {
      key: "state",
      get: function get() {
        return {
          chunks: this.chunks.map(function (c) {
            return c.state;
          }),
          from: this.from,
          stop: this.stop,
          blockIndex: this.blockIndex
        };
      },
      set: function set(state) {
        var chunks = state.chunks,
            props = _objectWithoutProperties(state, _excluded$1);

        Object.assign(this, props);
        this.chunks = chunks.map(function (cstate) {
          var chunk = "chunks" in cstate ? new ChunksTailDetails() : new ContinuousTailDetails(); // $FlowFixMe already checked above

          chunk.state = cstate;
          return chunk;
        });
      }
    }, {
      key: "shiftBefore",
      value: function shiftBefore(pos) {
        if (this.from >= pos || !this.chunks.length) return '';
        var chunkShiftPos = pos - this.from;
        var ci = 0;

        while (ci < this.chunks.length) {
          var chunk = this.chunks[ci];
          var shiftChar = chunk.shiftBefore(chunkShiftPos);

          if (chunk.toString()) {
            // chunk still contains value
            // but not shifted - means no more available chars to shift
            if (!shiftChar) break;
            ++ci;
          } else {
            // clean if chunk has no value
            this.chunks.splice(ci, 1);
          }

          if (shiftChar) return shiftChar;
        }

        return '';
      }
    }]);

    return ChunksTailDetails;
  }();

  /** Masking by RegExp */

  var MaskedRegExp = /*#__PURE__*/function (_Masked) {
    _inherits$1(MaskedRegExp, _Masked);

    var _super = _createSuper$1(MaskedRegExp);

    function MaskedRegExp() {
      _classCallCheck$1(this, MaskedRegExp);

      return _super.apply(this, arguments);
    }

    _createClass$1(MaskedRegExp, [{
      key: "_update",
      value:
      /**
        @override
        @param {Object} opts
      */
      function _update(opts) {
        if (opts.mask) opts.validate = function (value) {
          return value.search(opts.mask) >= 0;
        };

        _get$1(_getPrototypeOf$1(MaskedRegExp.prototype), "_update", this).call(this, opts);
      }
    }]);

    return MaskedRegExp;
  }(Masked);
  IMask$1.MaskedRegExp = MaskedRegExp;

  var _excluded$2 = ["_blocks"];

  /**
    Pattern mask
    @param {Object} opts
    @param {Object} opts.blocks
    @param {Object} opts.definitions
    @param {string} opts.placeholderChar
    @param {boolean} opts.lazy
  */
  var MaskedPattern = /*#__PURE__*/function (_Masked) {
    _inherits$1(MaskedPattern, _Masked);

    var _super = _createSuper$1(MaskedPattern);

    /** */

    /** */

    /** Single char for empty input */

    /** Show placeholder only when needed */
    function MaskedPattern() {
      var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck$1(this, MaskedPattern);

      // TODO type $Shape<MaskedPatternOptions>={} does not work
      opts.definitions = Object.assign({}, DEFAULT_INPUT_DEFINITIONS, opts.definitions);
      return _super.call(this, Object.assign({}, MaskedPattern.DEFAULTS, opts));
    }
    /**
      @override
      @param {Object} opts
    */


    _createClass$1(MaskedPattern, [{
      key: "_update",
      value: function _update() {
        var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        opts.definitions = Object.assign({}, this.definitions, opts.definitions);

        _get$1(_getPrototypeOf$1(MaskedPattern.prototype), "_update", this).call(this, opts);

        this._rebuildMask();
      }
      /** */

    }, {
      key: "_rebuildMask",
      value: function _rebuildMask() {
        var _this = this;

        var defs = this.definitions;
        this._blocks = [];
        this._stops = [];
        this._maskedBlocks = {};
        var pattern = this.mask;
        if (!pattern || !defs) return;
        var unmaskingBlock = false;
        var optionalBlock = false;

        for (var i = 0; i < pattern.length; ++i) {
          if (this.blocks) {
            var _ret = function () {
              var p = pattern.slice(i);
              var bNames = Object.keys(_this.blocks).filter(function (bName) {
                return p.indexOf(bName) === 0;
              }); // order by key length

              bNames.sort(function (a, b) {
                return b.length - a.length;
              }); // use block name with max length

              var bName = bNames[0];

              if (bName) {
                // $FlowFixMe no ideas
                var maskedBlock = createMask(Object.assign({
                  parent: _this,
                  lazy: _this.lazy,
                  placeholderChar: _this.placeholderChar,
                  overwrite: _this.overwrite
                }, _this.blocks[bName]));

                if (maskedBlock) {
                  _this._blocks.push(maskedBlock); // store block index


                  if (!_this._maskedBlocks[bName]) _this._maskedBlocks[bName] = [];

                  _this._maskedBlocks[bName].push(_this._blocks.length - 1);
                }

                i += bName.length - 1;
                return "continue";
              }
            }();

            if (_ret === "continue") continue;
          }

          var char = pattern[i];

          var _isInput = (char in defs);

          if (char === MaskedPattern.STOP_CHAR) {
            this._stops.push(this._blocks.length);

            continue;
          }

          if (char === '{' || char === '}') {
            unmaskingBlock = !unmaskingBlock;
            continue;
          }

          if (char === '[' || char === ']') {
            optionalBlock = !optionalBlock;
            continue;
          }

          if (char === MaskedPattern.ESCAPE_CHAR) {
            ++i;
            char = pattern[i];
            if (!char) break;
            _isInput = false;
          }

          var def = _isInput ? new PatternInputDefinition({
            parent: this,
            lazy: this.lazy,
            placeholderChar: this.placeholderChar,
            mask: defs[char],
            isOptional: optionalBlock
          }) : new PatternFixedDefinition({
            char: char,
            isUnmasking: unmaskingBlock
          });

          this._blocks.push(def);
        }
      }
      /**
        @override
      */

    }, {
      key: "state",
      get: function get() {
        return Object.assign({}, _get$1(_getPrototypeOf$1(MaskedPattern.prototype), "state", this), {
          _blocks: this._blocks.map(function (b) {
            return b.state;
          })
        });
      },
      set: function set(state) {
        var _blocks = state._blocks,
            maskedState = _objectWithoutProperties(state, _excluded$2);

        this._blocks.forEach(function (b, bi) {
          return b.state = _blocks[bi];
        });

        _set(_getPrototypeOf$1(MaskedPattern.prototype), "state", maskedState, this, true);
      }
      /**
        @override
      */

    }, {
      key: "reset",
      value: function reset() {
        _get$1(_getPrototypeOf$1(MaskedPattern.prototype), "reset", this).call(this);

        this._blocks.forEach(function (b) {
          return b.reset();
        });
      }
      /**
        @override
      */

    }, {
      key: "isComplete",
      get: function get() {
        return this._blocks.every(function (b) {
          return b.isComplete;
        });
      }
      /**
        @override
      */

    }, {
      key: "doCommit",
      value: function doCommit() {
        this._blocks.forEach(function (b) {
          return b.doCommit();
        });

        _get$1(_getPrototypeOf$1(MaskedPattern.prototype), "doCommit", this).call(this);
      }
      /**
        @override
      */

    }, {
      key: "unmaskedValue",
      get: function get() {
        return this._blocks.reduce(function (str, b) {
          return str += b.unmaskedValue;
        }, '');
      },
      set: function set(unmaskedValue) {
        _set(_getPrototypeOf$1(MaskedPattern.prototype), "unmaskedValue", unmaskedValue, this, true);
      }
      /**
        @override
      */

    }, {
      key: "value",
      get: function get() {
        // TODO return _value when not in change?
        return this._blocks.reduce(function (str, b) {
          return str += b.value;
        }, '');
      },
      set: function set(value) {
        _set(_getPrototypeOf$1(MaskedPattern.prototype), "value", value, this, true);
      }
      /**
        @override
      */

    }, {
      key: "appendTail",
      value: function appendTail(tail) {
        return _get$1(_getPrototypeOf$1(MaskedPattern.prototype), "appendTail", this).call(this, tail).aggregate(this._appendPlaceholder());
      }
      /**
        @override
      */

    }, {
      key: "_appendCharRaw",
      value: function _appendCharRaw(ch) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var blockIter = this._mapPosToBlock(this.value.length);

        var details = new ChangeDetails();
        if (!blockIter) return details;

        for (var bi = blockIter.index;; ++bi) {
          var _block = this._blocks[bi];
          if (!_block) break;

          var blockDetails = _block._appendChar(ch, flags);

          var skip = blockDetails.skip;
          details.aggregate(blockDetails);
          if (skip || blockDetails.rawInserted) break; // go next char
        }

        return details;
      }
      /**
        @override
      */

    }, {
      key: "extractTail",
      value: function extractTail() {
        var _this2 = this;

        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        var chunkTail = new ChunksTailDetails();
        if (fromPos === toPos) return chunkTail;

        this._forEachBlocksInRange(fromPos, toPos, function (b, bi, bFromPos, bToPos) {
          var blockChunk = b.extractTail(bFromPos, bToPos);
          blockChunk.stop = _this2._findStopBefore(bi);
          blockChunk.from = _this2._blockStartPos(bi);
          if (blockChunk instanceof ChunksTailDetails) blockChunk.blockIndex = bi;
          chunkTail.extend(blockChunk);
        });

        return chunkTail;
      }
      /**
        @override
      */

    }, {
      key: "extractInput",
      value: function extractInput() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        var flags = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        if (fromPos === toPos) return '';
        var input = '';

        this._forEachBlocksInRange(fromPos, toPos, function (b, _, fromPos, toPos) {
          input += b.extractInput(fromPos, toPos, flags);
        });

        return input;
      }
    }, {
      key: "_findStopBefore",
      value: function _findStopBefore(blockIndex) {
        var stopBefore;

        for (var si = 0; si < this._stops.length; ++si) {
          var stop = this._stops[si];
          if (stop <= blockIndex) stopBefore = stop;else break;
        }

        return stopBefore;
      }
      /** Appends placeholder depending on laziness */

    }, {
      key: "_appendPlaceholder",
      value: function _appendPlaceholder(toBlockIndex) {
        var _this3 = this;

        var details = new ChangeDetails();
        if (this.lazy && toBlockIndex == null) return details;

        var startBlockIter = this._mapPosToBlock(this.value.length);

        if (!startBlockIter) return details;
        var startBlockIndex = startBlockIter.index;
        var endBlockIndex = toBlockIndex != null ? toBlockIndex : this._blocks.length;

        this._blocks.slice(startBlockIndex, endBlockIndex).forEach(function (b) {
          if (!b.lazy || toBlockIndex != null) {
            // $FlowFixMe `_blocks` may not be present
            var args = b._blocks != null ? [b._blocks.length] : [];

            var bDetails = b._appendPlaceholder.apply(b, args);

            _this3._value += bDetails.inserted;
            details.aggregate(bDetails);
          }
        });

        return details;
      }
      /** Finds block in pos */

    }, {
      key: "_mapPosToBlock",
      value: function _mapPosToBlock(pos) {
        var accVal = '';

        for (var bi = 0; bi < this._blocks.length; ++bi) {
          var _block2 = this._blocks[bi];
          var blockStartPos = accVal.length;
          accVal += _block2.value;

          if (pos <= accVal.length) {
            return {
              index: bi,
              offset: pos - blockStartPos
            };
          }
        }
      }
      /** */

    }, {
      key: "_blockStartPos",
      value: function _blockStartPos(blockIndex) {
        return this._blocks.slice(0, blockIndex).reduce(function (pos, b) {
          return pos += b.value.length;
        }, 0);
      }
      /** */

    }, {
      key: "_forEachBlocksInRange",
      value: function _forEachBlocksInRange(fromPos) {
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        var fn = arguments.length > 2 ? arguments[2] : undefined;

        var fromBlockIter = this._mapPosToBlock(fromPos);

        if (fromBlockIter) {
          var toBlockIter = this._mapPosToBlock(toPos); // process first block


          var isSameBlock = toBlockIter && fromBlockIter.index === toBlockIter.index;
          var fromBlockStartPos = fromBlockIter.offset;
          var fromBlockEndPos = toBlockIter && isSameBlock ? toBlockIter.offset : this._blocks[fromBlockIter.index].value.length;
          fn(this._blocks[fromBlockIter.index], fromBlockIter.index, fromBlockStartPos, fromBlockEndPos);

          if (toBlockIter && !isSameBlock) {
            // process intermediate blocks
            for (var bi = fromBlockIter.index + 1; bi < toBlockIter.index; ++bi) {
              fn(this._blocks[bi], bi, 0, this._blocks[bi].value.length);
            } // process last block


            fn(this._blocks[toBlockIter.index], toBlockIter.index, 0, toBlockIter.offset);
          }
        }
      }
      /**
        @override
      */

    }, {
      key: "remove",
      value: function remove() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;

        var removeDetails = _get$1(_getPrototypeOf$1(MaskedPattern.prototype), "remove", this).call(this, fromPos, toPos);

        this._forEachBlocksInRange(fromPos, toPos, function (b, _, bFromPos, bToPos) {
          removeDetails.aggregate(b.remove(bFromPos, bToPos));
        });

        return removeDetails;
      }
      /**
        @override
      */

    }, {
      key: "nearestInputPos",
      value: function nearestInputPos(cursorPos) {
        var direction = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DIRECTION.NONE;
        // TODO refactor - extract alignblock
        var beginBlockData = this._mapPosToBlock(cursorPos) || {
          index: 0,
          offset: 0
        };
        var beginBlockOffset = beginBlockData.offset,
            beginBlockIndex = beginBlockData.index;
        var beginBlock = this._blocks[beginBlockIndex];
        if (!beginBlock) return cursorPos;
        var beginBlockCursorPos = beginBlockOffset; // if position inside block - try to adjust it

        if (beginBlockCursorPos !== 0 && beginBlockCursorPos < beginBlock.value.length) {
          beginBlockCursorPos = beginBlock.nearestInputPos(beginBlockOffset, forceDirection(direction));
        }

        var cursorAtRight = beginBlockCursorPos === beginBlock.value.length;
        var cursorAtLeft = beginBlockCursorPos === 0; //  cursor is INSIDE first block (not at bounds)

        if (!cursorAtLeft && !cursorAtRight) return this._blockStartPos(beginBlockIndex) + beginBlockCursorPos;
        var searchBlockIndex = cursorAtRight ? beginBlockIndex + 1 : beginBlockIndex;

        if (direction === DIRECTION.NONE) {
          // NONE direction used to calculate start input position if no chars were removed
          // FOR NONE:
          // -
          // input|any
          // ->
          //  any|input
          // <-
          //  filled-input|any
          // check if first block at left is input
          if (searchBlockIndex > 0) {
            var blockIndexAtLeft = searchBlockIndex - 1;
            var blockAtLeft = this._blocks[blockIndexAtLeft];
            var blockInputPos = blockAtLeft.nearestInputPos(0, DIRECTION.NONE); // is input

            if (!blockAtLeft.value.length || blockInputPos !== blockAtLeft.value.length) {
              return this._blockStartPos(searchBlockIndex);
            }
          } // ->


          var firstInputAtRight = searchBlockIndex;

          for (var bi = firstInputAtRight; bi < this._blocks.length; ++bi) {
            var blockAtRight = this._blocks[bi];

            var _blockInputPos = blockAtRight.nearestInputPos(0, DIRECTION.NONE);

            if (!blockAtRight.value.length || _blockInputPos !== blockAtRight.value.length) {
              return this._blockStartPos(bi) + _blockInputPos;
            }
          } // <-
          // find first non-fixed symbol


          for (var _bi = searchBlockIndex - 1; _bi >= 0; --_bi) {
            var _block3 = this._blocks[_bi];

            var _blockInputPos2 = _block3.nearestInputPos(0, DIRECTION.NONE); // is input


            if (!_block3.value.length || _blockInputPos2 !== _block3.value.length) {
              return this._blockStartPos(_bi) + _block3.value.length;
            }
          }

          return cursorPos;
        }

        if (direction === DIRECTION.LEFT || direction === DIRECTION.FORCE_LEFT) {
          // -
          //  any|filled-input
          // <-
          //  any|first not empty is not-len-aligned
          //  not-0-aligned|any
          // ->
          //  any|not-len-aligned or end
          // check if first block at right is filled input
          var firstFilledBlockIndexAtRight;

          for (var _bi2 = searchBlockIndex; _bi2 < this._blocks.length; ++_bi2) {
            if (this._blocks[_bi2].value) {
              firstFilledBlockIndexAtRight = _bi2;
              break;
            }
          }

          if (firstFilledBlockIndexAtRight != null) {
            var filledBlock = this._blocks[firstFilledBlockIndexAtRight];

            var _blockInputPos3 = filledBlock.nearestInputPos(0, DIRECTION.RIGHT);

            if (_blockInputPos3 === 0 && filledBlock.unmaskedValue.length) {
              // filled block is input
              return this._blockStartPos(firstFilledBlockIndexAtRight) + _blockInputPos3;
            }
          } // <-
          // find this vars


          var firstFilledInputBlockIndex = -1;
          var firstEmptyInputBlockIndex; // TODO consider nested empty inputs

          for (var _bi3 = searchBlockIndex - 1; _bi3 >= 0; --_bi3) {
            var _block4 = this._blocks[_bi3];

            var _blockInputPos4 = _block4.nearestInputPos(_block4.value.length, DIRECTION.FORCE_LEFT);

            if (!_block4.value || _blockInputPos4 !== 0) firstEmptyInputBlockIndex = _bi3;

            if (_blockInputPos4 !== 0) {
              if (_blockInputPos4 !== _block4.value.length) {
                // aligned inside block - return immediately
                return this._blockStartPos(_bi3) + _blockInputPos4;
              } else {
                // found filled
                firstFilledInputBlockIndex = _bi3;
                break;
              }
            }
          }

          if (direction === DIRECTION.LEFT) {
            // try find first empty input before start searching position only when not forced
            for (var _bi4 = firstFilledInputBlockIndex + 1; _bi4 <= Math.min(searchBlockIndex, this._blocks.length - 1); ++_bi4) {
              var _block5 = this._blocks[_bi4];

              var _blockInputPos5 = _block5.nearestInputPos(0, DIRECTION.NONE);

              var blockAlignedPos = this._blockStartPos(_bi4) + _blockInputPos5;

              if (blockAlignedPos > cursorPos) break; // if block is not lazy input

              if (_blockInputPos5 !== _block5.value.length) return blockAlignedPos;
            }
          } // process overflow


          if (firstFilledInputBlockIndex >= 0) {
            return this._blockStartPos(firstFilledInputBlockIndex) + this._blocks[firstFilledInputBlockIndex].value.length;
          } // for lazy if has aligned left inside fixed and has came to the start - use start position


          if (direction === DIRECTION.FORCE_LEFT || this.lazy && !this.extractInput() && !isInput(this._blocks[searchBlockIndex])) {
            return 0;
          }

          if (firstEmptyInputBlockIndex != null) {
            return this._blockStartPos(firstEmptyInputBlockIndex);
          } // find first input


          for (var _bi5 = searchBlockIndex; _bi5 < this._blocks.length; ++_bi5) {
            var _block6 = this._blocks[_bi5];

            var _blockInputPos6 = _block6.nearestInputPos(0, DIRECTION.NONE); // is input


            if (!_block6.value.length || _blockInputPos6 !== _block6.value.length) {
              return this._blockStartPos(_bi5) + _blockInputPos6;
            }
          }

          return 0;
        }

        if (direction === DIRECTION.RIGHT || direction === DIRECTION.FORCE_RIGHT) {
          // ->
          //  any|not-len-aligned and filled
          //  any|not-len-aligned
          // <-
          //  not-0-aligned or start|any
          var firstInputBlockAlignedIndex;
          var firstInputBlockAlignedPos;

          for (var _bi6 = searchBlockIndex; _bi6 < this._blocks.length; ++_bi6) {
            var _block7 = this._blocks[_bi6];

            var _blockInputPos7 = _block7.nearestInputPos(0, DIRECTION.NONE);

            if (_blockInputPos7 !== _block7.value.length) {
              firstInputBlockAlignedPos = this._blockStartPos(_bi6) + _blockInputPos7;
              firstInputBlockAlignedIndex = _bi6;
              break;
            }
          }

          if (firstInputBlockAlignedIndex != null && firstInputBlockAlignedPos != null) {
            for (var _bi7 = firstInputBlockAlignedIndex; _bi7 < this._blocks.length; ++_bi7) {
              var _block8 = this._blocks[_bi7];

              var _blockInputPos8 = _block8.nearestInputPos(0, DIRECTION.FORCE_RIGHT);

              if (_blockInputPos8 !== _block8.value.length) {
                return this._blockStartPos(_bi7) + _blockInputPos8;
              }
            }

            return direction === DIRECTION.FORCE_RIGHT ? this.value.length : firstInputBlockAlignedPos;
          }

          for (var _bi8 = Math.min(searchBlockIndex, this._blocks.length - 1); _bi8 >= 0; --_bi8) {
            var _block9 = this._blocks[_bi8];

            var _blockInputPos9 = _block9.nearestInputPos(_block9.value.length, DIRECTION.LEFT);

            if (_blockInputPos9 !== 0) {
              var alignedPos = this._blockStartPos(_bi8) + _blockInputPos9;

              if (alignedPos >= cursorPos) return alignedPos;
              break;
            }
          }
        }

        return cursorPos;
      }
      /** Get block by name */

    }, {
      key: "maskedBlock",
      value: function maskedBlock(name) {
        return this.maskedBlocks(name)[0];
      }
      /** Get all blocks by name */

    }, {
      key: "maskedBlocks",
      value: function maskedBlocks(name) {
        var _this4 = this;

        var indices = this._maskedBlocks[name];
        if (!indices) return [];
        return indices.map(function (gi) {
          return _this4._blocks[gi];
        });
      }
    }]);

    return MaskedPattern;
  }(Masked);
  MaskedPattern.DEFAULTS = {
    lazy: true,
    placeholderChar: '_'
  };
  MaskedPattern.STOP_CHAR = '`';
  MaskedPattern.ESCAPE_CHAR = '\\';
  MaskedPattern.InputDefinition = PatternInputDefinition;
  MaskedPattern.FixedDefinition = PatternFixedDefinition;

  function isInput(block) {
    if (!block) return false;
    var value = block.value;
    return !value || block.nearestInputPos(0, DIRECTION.NONE) !== value.length;
  }

  IMask$1.MaskedPattern = MaskedPattern;

  /** Pattern which accepts ranges */

  var MaskedRange = /*#__PURE__*/function (_MaskedPattern) {
    _inherits$1(MaskedRange, _MaskedPattern);

    var _super = _createSuper$1(MaskedRange);

    function MaskedRange() {
      _classCallCheck$1(this, MaskedRange);

      return _super.apply(this, arguments);
    }

    _createClass$1(MaskedRange, [{
      key: "_matchFrom",
      get:
      /**
        Optionally sets max length of pattern.
        Used when pattern length is longer then `to` param length. Pads zeros at start in this case.
      */

      /** Min bound */

      /** Max bound */

      /** */
      function get() {
        return this.maxLength - String(this.from).length;
      }
      /**
        @override
      */

    }, {
      key: "_update",
      value: function _update(opts) {
        // TODO type
        opts = Object.assign({
          to: this.to || 0,
          from: this.from || 0
        }, opts);
        var maxLength = String(opts.to).length;
        if (opts.maxLength != null) maxLength = Math.max(maxLength, opts.maxLength);
        opts.maxLength = maxLength;
        var fromStr = String(opts.from).padStart(maxLength, '0');
        var toStr = String(opts.to).padStart(maxLength, '0');
        var sameCharsCount = 0;

        while (sameCharsCount < toStr.length && toStr[sameCharsCount] === fromStr[sameCharsCount]) {
          ++sameCharsCount;
        }

        opts.mask = toStr.slice(0, sameCharsCount).replace(/0/g, '\\0') + '0'.repeat(maxLength - sameCharsCount);

        _get$1(_getPrototypeOf$1(MaskedRange.prototype), "_update", this).call(this, opts);
      }
      /**
        @override
      */

    }, {
      key: "isComplete",
      get: function get() {
        return _get$1(_getPrototypeOf$1(MaskedRange.prototype), "isComplete", this) && Boolean(this.value);
      }
    }, {
      key: "boundaries",
      value: function boundaries(str) {
        var minstr = '';
        var maxstr = '';

        var _ref = str.match(/^(\D*)(\d*)(\D*)/) || [],
            _ref2 = _slicedToArray$1(_ref, 3),
            placeholder = _ref2[1],
            num = _ref2[2];

        if (num) {
          minstr = '0'.repeat(placeholder.length) + num;
          maxstr = '9'.repeat(placeholder.length) + num;
        }

        minstr = minstr.padEnd(this.maxLength, '0');
        maxstr = maxstr.padEnd(this.maxLength, '9');
        return [minstr, maxstr];
      }
      /**
        @override
      */

    }, {
      key: "doPrepare",
      value: function doPrepare(str) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        str = _get$1(_getPrototypeOf$1(MaskedRange.prototype), "doPrepare", this).call(this, str, flags).replace(/\D/g, '');
        if (!this.autofix) return str;
        var fromStr = String(this.from).padStart(this.maxLength, '0');
        var toStr = String(this.to).padStart(this.maxLength, '0');
        var val = this.value;
        var prepStr = '';

        for (var ci = 0; ci < str.length; ++ci) {
          var nextVal = val + prepStr + str[ci];

          var _this$boundaries = this.boundaries(nextVal),
              _this$boundaries2 = _slicedToArray$1(_this$boundaries, 2),
              minstr = _this$boundaries2[0],
              maxstr = _this$boundaries2[1];

          if (Number(maxstr) < this.from) prepStr += fromStr[nextVal.length - 1];else if (Number(minstr) > this.to) prepStr += toStr[nextVal.length - 1];else prepStr += str[ci];
        }

        return prepStr;
      }
      /**
        @override
      */

    }, {
      key: "doValidate",
      value: function doValidate() {
        var _get2;

        var str = this.value;
        var firstNonZero = str.search(/[^0]/);
        if (firstNonZero === -1 && str.length <= this._matchFrom) return true;

        var _this$boundaries3 = this.boundaries(str),
            _this$boundaries4 = _slicedToArray$1(_this$boundaries3, 2),
            minstr = _this$boundaries4[0],
            maxstr = _this$boundaries4[1];

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return this.from <= Number(maxstr) && Number(minstr) <= this.to && (_get2 = _get$1(_getPrototypeOf$1(MaskedRange.prototype), "doValidate", this)).call.apply(_get2, [this].concat(args));
      }
    }]);

    return MaskedRange;
  }(MaskedPattern);
  IMask$1.MaskedRange = MaskedRange;

  /** Date mask */

  var MaskedDate = /*#__PURE__*/function (_MaskedPattern) {
    _inherits$1(MaskedDate, _MaskedPattern);

    var _super = _createSuper$1(MaskedDate);

    /** Pattern mask for date according to {@link MaskedDate#format} */

    /** Start date */

    /** End date */

    /** */

    /**
      @param {Object} opts
    */
    function MaskedDate(opts) {
      _classCallCheck$1(this, MaskedDate);

      return _super.call(this, Object.assign({}, MaskedDate.DEFAULTS, opts));
    }
    /**
      @override
    */


    _createClass$1(MaskedDate, [{
      key: "_update",
      value: function _update(opts) {
        if (opts.mask === Date) delete opts.mask;
        if (opts.pattern) opts.mask = opts.pattern;
        var blocks = opts.blocks;
        opts.blocks = Object.assign({}, MaskedDate.GET_DEFAULT_BLOCKS()); // adjust year block

        if (opts.min) opts.blocks.Y.from = opts.min.getFullYear();
        if (opts.max) opts.blocks.Y.to = opts.max.getFullYear();

        if (opts.min && opts.max && opts.blocks.Y.from === opts.blocks.Y.to) {
          opts.blocks.m.from = opts.min.getMonth() + 1;
          opts.blocks.m.to = opts.max.getMonth() + 1;

          if (opts.blocks.m.from === opts.blocks.m.to) {
            opts.blocks.d.from = opts.min.getDate();
            opts.blocks.d.to = opts.max.getDate();
          }
        }

        Object.assign(opts.blocks, blocks); // add autofix

        Object.keys(opts.blocks).forEach(function (bk) {
          var b = opts.blocks[bk];
          if (!('autofix' in b)) b.autofix = opts.autofix;
        });

        _get$1(_getPrototypeOf$1(MaskedDate.prototype), "_update", this).call(this, opts);
      }
      /**
        @override
      */

    }, {
      key: "doValidate",
      value: function doValidate() {
        var _get2;

        var date = this.date;

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return (_get2 = _get$1(_getPrototypeOf$1(MaskedDate.prototype), "doValidate", this)).call.apply(_get2, [this].concat(args)) && (!this.isComplete || this.isDateExist(this.value) && date != null && (this.min == null || this.min <= date) && (this.max == null || date <= this.max));
      }
      /** Checks if date is exists */

    }, {
      key: "isDateExist",
      value: function isDateExist(str) {
        return this.format(this.parse(str, this), this).indexOf(str) >= 0;
      }
      /** Parsed Date */

    }, {
      key: "date",
      get: function get() {
        return this.typedValue;
      },
      set: function set(date) {
        this.typedValue = date;
      }
      /**
        @override
      */

    }, {
      key: "typedValue",
      get: function get() {
        return this.isComplete ? _get$1(_getPrototypeOf$1(MaskedDate.prototype), "typedValue", this) : null;
      },
      set: function set(value) {
        _set(_getPrototypeOf$1(MaskedDate.prototype), "typedValue", value, this, true);
      }
    }]);

    return MaskedDate;
  }(MaskedPattern);
  MaskedDate.DEFAULTS = {
    pattern: 'd{.}`m{.}`Y',
    format: function format(date) {
      var day = String(date.getDate()).padStart(2, '0');
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var year = date.getFullYear();
      return [day, month, year].join('.');
    },
    parse: function parse(str) {
      var _str$split = str.split('.'),
          _str$split2 = _slicedToArray$1(_str$split, 3),
          day = _str$split2[0],
          month = _str$split2[1],
          year = _str$split2[2];

      return new Date(year, month - 1, day);
    }
  };

  MaskedDate.GET_DEFAULT_BLOCKS = function () {
    return {
      d: {
        mask: MaskedRange,
        from: 1,
        to: 31,
        maxLength: 2
      },
      m: {
        mask: MaskedRange,
        from: 1,
        to: 12,
        maxLength: 2
      },
      Y: {
        mask: MaskedRange,
        from: 1900,
        to: 9999
      }
    };
  };

  IMask$1.MaskedDate = MaskedDate;

  /**
    Generic element API to use with mask
    @interface
  */
  var MaskElement = /*#__PURE__*/function () {
    function MaskElement() {
      _classCallCheck$1(this, MaskElement);
    }

    _createClass$1(MaskElement, [{
      key: "selectionStart",
      get:
      /** */

      /** */

      /** */

      /** Safely returns selection start */
      function get() {
        var start;

        try {
          start = this._unsafeSelectionStart;
        } catch (e) {}

        return start != null ? start : this.value.length;
      }
      /** Safely returns selection end */

    }, {
      key: "selectionEnd",
      get: function get() {
        var end;

        try {
          end = this._unsafeSelectionEnd;
        } catch (e) {}

        return end != null ? end : this.value.length;
      }
      /** Safely sets element selection */

    }, {
      key: "select",
      value: function select(start, end) {
        if (start == null || end == null || start === this.selectionStart && end === this.selectionEnd) return;

        try {
          this._unsafeSelect(start, end);
        } catch (e) {}
      }
      /** Should be overriden in subclasses */

    }, {
      key: "_unsafeSelect",
      value: function _unsafeSelect(start, end) {}
      /** Should be overriden in subclasses */

    }, {
      key: "isActive",
      get: function get() {
        return false;
      }
      /** Should be overriden in subclasses */

    }, {
      key: "bindEvents",
      value: function bindEvents(handlers) {}
      /** Should be overriden in subclasses */

    }, {
      key: "unbindEvents",
      value: function unbindEvents() {}
    }]);

    return MaskElement;
  }();
  IMask$1.MaskElement = MaskElement;

  /** Bridge between HTMLElement and {@link Masked} */

  var HTMLMaskElement = /*#__PURE__*/function (_MaskElement) {
    _inherits$1(HTMLMaskElement, _MaskElement);

    var _super = _createSuper$1(HTMLMaskElement);

    /** Mapping between HTMLElement events and mask internal events */

    /** HTMLElement to use mask on */

    /**
      @param {HTMLInputElement|HTMLTextAreaElement} input
    */
    function HTMLMaskElement(input) {
      var _this;

      _classCallCheck$1(this, HTMLMaskElement);

      _this = _super.call(this);
      _this.input = input;
      _this._handlers = {};
      return _this;
    }
    /** */
    // $FlowFixMe https://github.com/facebook/flow/issues/2839


    _createClass$1(HTMLMaskElement, [{
      key: "rootElement",
      get: function get() {
        return this.input.getRootNode ? this.input.getRootNode() : document;
      }
      /**
        Is element in focus
        @readonly
      */

    }, {
      key: "isActive",
      get: function get() {
        //$FlowFixMe
        return this.input === this.rootElement.activeElement;
      }
      /**
        Returns HTMLElement selection start
        @override
      */

    }, {
      key: "_unsafeSelectionStart",
      get: function get() {
        return this.input.selectionStart;
      }
      /**
        Returns HTMLElement selection end
        @override
      */

    }, {
      key: "_unsafeSelectionEnd",
      get: function get() {
        return this.input.selectionEnd;
      }
      /**
        Sets HTMLElement selection
        @override
      */

    }, {
      key: "_unsafeSelect",
      value: function _unsafeSelect(start, end) {
        this.input.setSelectionRange(start, end);
      }
      /**
        HTMLElement value
        @override
      */

    }, {
      key: "value",
      get: function get() {
        return this.input.value;
      },
      set: function set(value) {
        this.input.value = value;
      }
      /**
        Binds HTMLElement events to mask internal events
        @override
      */

    }, {
      key: "bindEvents",
      value: function bindEvents(handlers) {
        var _this2 = this;

        Object.keys(handlers).forEach(function (event) {
          return _this2._toggleEventHandler(HTMLMaskElement.EVENTS_MAP[event], handlers[event]);
        });
      }
      /**
        Unbinds HTMLElement events to mask internal events
        @override
      */

    }, {
      key: "unbindEvents",
      value: function unbindEvents() {
        var _this3 = this;

        Object.keys(this._handlers).forEach(function (event) {
          return _this3._toggleEventHandler(event);
        });
      }
      /** */

    }, {
      key: "_toggleEventHandler",
      value: function _toggleEventHandler(event, handler) {
        if (this._handlers[event]) {
          this.input.removeEventListener(event, this._handlers[event]);
          delete this._handlers[event];
        }

        if (handler) {
          this.input.addEventListener(event, handler);
          this._handlers[event] = handler;
        }
      }
    }]);

    return HTMLMaskElement;
  }(MaskElement);
  HTMLMaskElement.EVENTS_MAP = {
    selectionChange: 'keydown',
    input: 'input',
    drop: 'drop',
    click: 'click',
    focus: 'focus',
    commit: 'blur'
  };
  IMask$1.HTMLMaskElement = HTMLMaskElement;

  var HTMLContenteditableMaskElement = /*#__PURE__*/function (_HTMLMaskElement) {
    _inherits$1(HTMLContenteditableMaskElement, _HTMLMaskElement);

    var _super = _createSuper$1(HTMLContenteditableMaskElement);

    function HTMLContenteditableMaskElement() {
      _classCallCheck$1(this, HTMLContenteditableMaskElement);

      return _super.apply(this, arguments);
    }

    _createClass$1(HTMLContenteditableMaskElement, [{
      key: "_unsafeSelectionStart",
      get:
      /**
        Returns HTMLElement selection start
        @override
      */
      function get() {
        var root = this.rootElement;
        var selection = root.getSelection && root.getSelection();
        return selection && selection.anchorOffset;
      }
      /**
        Returns HTMLElement selection end
        @override
      */

    }, {
      key: "_unsafeSelectionEnd",
      get: function get() {
        var root = this.rootElement;
        var selection = root.getSelection && root.getSelection();
        return selection && this._unsafeSelectionStart + String(selection).length;
      }
      /**
        Sets HTMLElement selection
        @override
      */

    }, {
      key: "_unsafeSelect",
      value: function _unsafeSelect(start, end) {
        if (!this.rootElement.createRange) return;
        var range = this.rootElement.createRange();
        range.setStart(this.input.firstChild || this.input, start);
        range.setEnd(this.input.lastChild || this.input, end);
        var root = this.rootElement;
        var selection = root.getSelection && root.getSelection();

        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      /**
        HTMLElement value
        @override
      */

    }, {
      key: "value",
      get: function get() {
        // $FlowFixMe
        return this.input.textContent;
      },
      set: function set(value) {
        this.input.textContent = value;
      }
    }]);

    return HTMLContenteditableMaskElement;
  }(HTMLMaskElement);
  IMask$1.HTMLContenteditableMaskElement = HTMLContenteditableMaskElement;

  var _excluded$3 = ["mask"];
  /** Listens to element events and controls changes between element and {@link Masked} */

  var InputMask = /*#__PURE__*/function () {
    /**
      View element
      @readonly
    */

    /**
      Internal {@link Masked} model
      @readonly
    */

    /**
      @param {MaskElement|HTMLInputElement|HTMLTextAreaElement} el
      @param {Object} opts
    */
    function InputMask(el, opts) {
      _classCallCheck$1(this, InputMask);

      this.el = el instanceof MaskElement ? el : el.isContentEditable && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' ? new HTMLContenteditableMaskElement(el) : new HTMLMaskElement(el);
      this.masked = createMask(opts);
      this._listeners = {};
      this._value = '';
      this._unmaskedValue = '';
      this._saveSelection = this._saveSelection.bind(this);
      this._onInput = this._onInput.bind(this);
      this._onChange = this._onChange.bind(this);
      this._onDrop = this._onDrop.bind(this);
      this._onFocus = this._onFocus.bind(this);
      this._onClick = this._onClick.bind(this);
      this.alignCursor = this.alignCursor.bind(this);
      this.alignCursorFriendly = this.alignCursorFriendly.bind(this);

      this._bindEvents(); // refresh


      this.updateValue();

      this._onChange();
    }
    /** Read or update mask */


    _createClass$1(InputMask, [{
      key: "mask",
      get: function get() {
        return this.masked.mask;
      },
      set: function set(mask) {
        if (this.maskEquals(mask)) return;

        if (!(mask instanceof IMask$1.Masked) && this.masked.constructor === maskedClass(mask)) {
          this.masked.updateOptions({
            mask: mask
          });
          return;
        }

        var masked = createMask({
          mask: mask
        });
        masked.unmaskedValue = this.masked.unmaskedValue;
        this.masked = masked;
      }
      /** Raw value */

    }, {
      key: "maskEquals",
      value: function maskEquals(mask) {
        return mask == null || mask === this.masked.mask || mask === Date && this.masked instanceof MaskedDate;
      }
    }, {
      key: "value",
      get: function get() {
        return this._value;
      },
      set: function set(str) {
        this.masked.value = str;
        this.updateControl();
        this.alignCursor();
      }
      /** Unmasked value */

    }, {
      key: "unmaskedValue",
      get: function get() {
        return this._unmaskedValue;
      },
      set: function set(str) {
        this.masked.unmaskedValue = str;
        this.updateControl();
        this.alignCursor();
      }
      /** Typed unmasked value */

    }, {
      key: "typedValue",
      get: function get() {
        return this.masked.typedValue;
      },
      set: function set(val) {
        this.masked.typedValue = val;
        this.updateControl();
        this.alignCursor();
      }
      /**
        Starts listening to element events
        @protected
      */

    }, {
      key: "_bindEvents",
      value: function _bindEvents() {
        this.el.bindEvents({
          selectionChange: this._saveSelection,
          input: this._onInput,
          drop: this._onDrop,
          click: this._onClick,
          focus: this._onFocus,
          commit: this._onChange
        });
      }
      /**
        Stops listening to element events
        @protected
       */

    }, {
      key: "_unbindEvents",
      value: function _unbindEvents() {
        if (this.el) this.el.unbindEvents();
      }
      /**
        Fires custom event
        @protected
       */

    }, {
      key: "_fireEvent",
      value: function _fireEvent(ev) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }

        var listeners = this._listeners[ev];
        if (!listeners) return;
        listeners.forEach(function (l) {
          return l.apply(void 0, args);
        });
      }
      /**
        Current selection start
        @readonly
      */

    }, {
      key: "selectionStart",
      get: function get() {
        return this._cursorChanging ? this._changingCursorPos : this.el.selectionStart;
      }
      /** Current cursor position */

    }, {
      key: "cursorPos",
      get: function get() {
        return this._cursorChanging ? this._changingCursorPos : this.el.selectionEnd;
      },
      set: function set(pos) {
        if (!this.el || !this.el.isActive) return;
        this.el.select(pos, pos);

        this._saveSelection();
      }
      /**
        Stores current selection
        @protected
      */

    }, {
      key: "_saveSelection",
      value: function _saveSelection() {
        if (this.value !== this.el.value) {
          console.warn('Element value was changed outside of mask. Syncronize mask using `mask.updateValue()` to work properly.'); // eslint-disable-line no-console
        }

        this._selection = {
          start: this.selectionStart,
          end: this.cursorPos
        };
      }
      /** Syncronizes model value from view */

    }, {
      key: "updateValue",
      value: function updateValue() {
        this.masked.value = this.el.value;
        this._value = this.masked.value;
      }
      /** Syncronizes view from model value, fires change events */

    }, {
      key: "updateControl",
      value: function updateControl() {
        var newUnmaskedValue = this.masked.unmaskedValue;
        var newValue = this.masked.value;
        var isChanged = this.unmaskedValue !== newUnmaskedValue || this.value !== newValue;
        this._unmaskedValue = newUnmaskedValue;
        this._value = newValue;
        if (this.el.value !== newValue) this.el.value = newValue;
        if (isChanged) this._fireChangeEvents();
      }
      /** Updates options with deep equal check, recreates @{link Masked} model if mask type changes */

    }, {
      key: "updateOptions",
      value: function updateOptions(opts) {
        var mask = opts.mask,
            restOpts = _objectWithoutProperties(opts, _excluded$3);

        var updateMask = !this.maskEquals(mask);
        var updateOpts = !objectIncludes(this.masked, restOpts);
        if (updateMask) this.mask = mask;
        if (updateOpts) this.masked.updateOptions(restOpts);
        if (updateMask || updateOpts) this.updateControl();
      }
      /** Updates cursor */

    }, {
      key: "updateCursor",
      value: function updateCursor(cursorPos) {
        if (cursorPos == null) return;
        this.cursorPos = cursorPos; // also queue change cursor for mobile browsers

        this._delayUpdateCursor(cursorPos);
      }
      /**
        Delays cursor update to support mobile browsers
        @private
      */

    }, {
      key: "_delayUpdateCursor",
      value: function _delayUpdateCursor(cursorPos) {
        var _this = this;

        this._abortUpdateCursor();

        this._changingCursorPos = cursorPos;
        this._cursorChanging = setTimeout(function () {
          if (!_this.el) return; // if was destroyed

          _this.cursorPos = _this._changingCursorPos;

          _this._abortUpdateCursor();
        }, 10);
      }
      /**
        Fires custom events
        @protected
      */

    }, {
      key: "_fireChangeEvents",
      value: function _fireChangeEvents() {
        this._fireEvent('accept', this._inputEvent);

        if (this.masked.isComplete) this._fireEvent('complete', this._inputEvent);
      }
      /**
        Aborts delayed cursor update
        @private
      */

    }, {
      key: "_abortUpdateCursor",
      value: function _abortUpdateCursor() {
        if (this._cursorChanging) {
          clearTimeout(this._cursorChanging);
          delete this._cursorChanging;
        }
      }
      /** Aligns cursor to nearest available position */

    }, {
      key: "alignCursor",
      value: function alignCursor() {
        this.cursorPos = this.masked.nearestInputPos(this.cursorPos, DIRECTION.LEFT);
      }
      /** Aligns cursor only if selection is empty */

    }, {
      key: "alignCursorFriendly",
      value: function alignCursorFriendly() {
        if (this.selectionStart !== this.cursorPos) return; // skip if range is selected

        this.alignCursor();
      }
      /** Adds listener on custom event */

    }, {
      key: "on",
      value: function on(ev, handler) {
        if (!this._listeners[ev]) this._listeners[ev] = [];

        this._listeners[ev].push(handler);

        return this;
      }
      /** Removes custom event listener */

    }, {
      key: "off",
      value: function off(ev, handler) {
        if (!this._listeners[ev]) return this;

        if (!handler) {
          delete this._listeners[ev];
          return this;
        }

        var hIndex = this._listeners[ev].indexOf(handler);

        if (hIndex >= 0) this._listeners[ev].splice(hIndex, 1);
        return this;
      }
      /** Handles view input event */

    }, {
      key: "_onInput",
      value: function _onInput(e) {
        this._inputEvent = e;

        this._abortUpdateCursor(); // fix strange IE behavior


        if (!this._selection) return this.updateValue();
        var details = new ActionDetails( // new state
        this.el.value, this.cursorPos, // old state
        this.value, this._selection);
        var oldRawValue = this.masked.rawInputValue;
        var offset = this.masked.splice(details.startChangePos, details.removed.length, details.inserted, details.removeDirection).offset; // force align in remove direction only if no input chars were removed
        // otherwise we still need to align with NONE (to get out from fixed symbols for instance)

        var removeDirection = oldRawValue === this.masked.rawInputValue ? details.removeDirection : DIRECTION.NONE;
        var cursorPos = this.masked.nearestInputPos(details.startChangePos + offset, removeDirection);
        this.updateControl();
        this.updateCursor(cursorPos);
        delete this._inputEvent;
      }
      /** Handles view change event and commits model value */

    }, {
      key: "_onChange",
      value: function _onChange() {
        if (this.value !== this.el.value) {
          this.updateValue();
        }

        this.masked.doCommit();
        this.updateControl();

        this._saveSelection();
      }
      /** Handles view drop event, prevents by default */

    }, {
      key: "_onDrop",
      value: function _onDrop(ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      /** Restore last selection on focus */

    }, {
      key: "_onFocus",
      value: function _onFocus(ev) {
        this.alignCursorFriendly();
      }
      /** Restore last selection on focus */

    }, {
      key: "_onClick",
      value: function _onClick(ev) {
        this.alignCursorFriendly();
      }
      /** Unbind view events and removes element reference */

    }, {
      key: "destroy",
      value: function destroy() {
        this._unbindEvents(); // $FlowFixMe why not do so?


        this._listeners.length = 0; // $FlowFixMe

        delete this.el;
      }
    }]);

    return InputMask;
  }();
  IMask$1.InputMask = InputMask;

  /** Pattern which validates enum values */

  var MaskedEnum = /*#__PURE__*/function (_MaskedPattern) {
    _inherits$1(MaskedEnum, _MaskedPattern);

    var _super = _createSuper$1(MaskedEnum);

    function MaskedEnum() {
      _classCallCheck$1(this, MaskedEnum);

      return _super.apply(this, arguments);
    }

    _createClass$1(MaskedEnum, [{
      key: "_update",
      value:
      /**
        @override
        @param {Object} opts
      */
      function _update(opts) {
        // TODO type
        if (opts.enum) opts.mask = '*'.repeat(opts.enum[0].length);

        _get$1(_getPrototypeOf$1(MaskedEnum.prototype), "_update", this).call(this, opts);
      }
      /**
        @override
      */

    }, {
      key: "doValidate",
      value: function doValidate() {
        var _this = this,
            _get2;

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return this.enum.some(function (e) {
          return e.indexOf(_this.unmaskedValue) >= 0;
        }) && (_get2 = _get$1(_getPrototypeOf$1(MaskedEnum.prototype), "doValidate", this)).call.apply(_get2, [this].concat(args));
      }
    }]);

    return MaskedEnum;
  }(MaskedPattern);
  IMask$1.MaskedEnum = MaskedEnum;

  /**
    Number mask
    @param {Object} opts
    @param {string} opts.radix - Single char
    @param {string} opts.thousandsSeparator - Single char
    @param {Array<string>} opts.mapToRadix - Array of single chars
    @param {number} opts.min
    @param {number} opts.max
    @param {number} opts.scale - Digits after point
    @param {boolean} opts.signed - Allow negative
    @param {boolean} opts.normalizeZeros - Flag to remove leading and trailing zeros in the end of editing
    @param {boolean} opts.padFractionalZeros - Flag to pad trailing zeros after point in the end of editing
  */
  var MaskedNumber = /*#__PURE__*/function (_Masked) {
    _inherits$1(MaskedNumber, _Masked);

    var _super = _createSuper$1(MaskedNumber);

    /** Single char */

    /** Single char */

    /** Array of single chars */

    /** */

    /** */

    /** Digits after point */

    /** */

    /** Flag to remove leading and trailing zeros in the end of editing */

    /** Flag to pad trailing zeros after point in the end of editing */
    function MaskedNumber(opts) {
      _classCallCheck$1(this, MaskedNumber);

      return _super.call(this, Object.assign({}, MaskedNumber.DEFAULTS, opts));
    }
    /**
      @override
    */


    _createClass$1(MaskedNumber, [{
      key: "_update",
      value: function _update(opts) {
        _get$1(_getPrototypeOf$1(MaskedNumber.prototype), "_update", this).call(this, opts);

        this._updateRegExps();
      }
      /** */

    }, {
      key: "_updateRegExps",
      value: function _updateRegExps() {
        // use different regexp to process user input (more strict, input suffix) and tail shifting
        var start = '^' + (this.allowNegative ? '[+|\\-]?' : '');
        var midInput = '(0|([1-9]+\\d*))?';
        var mid = '\\d*';
        var end = (this.scale ? '(' + escapeRegExp(this.radix) + '\\d{0,' + this.scale + '})?' : '') + '$';
        this._numberRegExpInput = new RegExp(start + midInput + end);
        this._numberRegExp = new RegExp(start + mid + end);
        this._mapToRadixRegExp = new RegExp('[' + this.mapToRadix.map(escapeRegExp).join('') + ']', 'g');
        this._thousandsSeparatorRegExp = new RegExp(escapeRegExp(this.thousandsSeparator), 'g');
      }
      /** */

    }, {
      key: "_removeThousandsSeparators",
      value: function _removeThousandsSeparators(value) {
        return value.replace(this._thousandsSeparatorRegExp, '');
      }
      /** */

    }, {
      key: "_insertThousandsSeparators",
      value: function _insertThousandsSeparators(value) {
        // https://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
        var parts = value.split(this.radix);
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, this.thousandsSeparator);
        return parts.join(this.radix);
      }
      /**
        @override
      */

    }, {
      key: "doPrepare",
      value: function doPrepare(str) {
        var _get2;

        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }

        return (_get2 = _get$1(_getPrototypeOf$1(MaskedNumber.prototype), "doPrepare", this)).call.apply(_get2, [this, this._removeThousandsSeparators(str.replace(this._mapToRadixRegExp, this.radix))].concat(args));
      }
      /** */

    }, {
      key: "_separatorsCount",
      value: function _separatorsCount(to) {
        var extendOnSeparators = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        var count = 0;

        for (var pos = 0; pos < to; ++pos) {
          if (this._value.indexOf(this.thousandsSeparator, pos) === pos) {
            ++count;
            if (extendOnSeparators) to += this.thousandsSeparator.length;
          }
        }

        return count;
      }
      /** */

    }, {
      key: "_separatorsCountFromSlice",
      value: function _separatorsCountFromSlice() {
        var slice = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this._value;
        return this._separatorsCount(this._removeThousandsSeparators(slice).length, true);
      }
      /**
        @override
      */

    }, {
      key: "extractInput",
      value: function extractInput() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        var flags = arguments.length > 2 ? arguments[2] : undefined;

        var _this$_adjustRangeWit = this._adjustRangeWithSeparators(fromPos, toPos);

        var _this$_adjustRangeWit2 = _slicedToArray$1(_this$_adjustRangeWit, 2);

        fromPos = _this$_adjustRangeWit2[0];
        toPos = _this$_adjustRangeWit2[1];
        return this._removeThousandsSeparators(_get$1(_getPrototypeOf$1(MaskedNumber.prototype), "extractInput", this).call(this, fromPos, toPos, flags));
      }
      /**
        @override
      */

    }, {
      key: "_appendCharRaw",
      value: function _appendCharRaw(ch) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (!this.thousandsSeparator) return _get$1(_getPrototypeOf$1(MaskedNumber.prototype), "_appendCharRaw", this).call(this, ch, flags);
        var prevBeforeTailValue = flags.tail && flags._beforeTailState ? flags._beforeTailState._value : this._value;

        var prevBeforeTailSeparatorsCount = this._separatorsCountFromSlice(prevBeforeTailValue);

        this._value = this._removeThousandsSeparators(this.value);

        var appendDetails = _get$1(_getPrototypeOf$1(MaskedNumber.prototype), "_appendCharRaw", this).call(this, ch, flags);

        this._value = this._insertThousandsSeparators(this._value);
        var beforeTailValue = flags.tail && flags._beforeTailState ? flags._beforeTailState._value : this._value;

        var beforeTailSeparatorsCount = this._separatorsCountFromSlice(beforeTailValue);

        appendDetails.tailShift += (beforeTailSeparatorsCount - prevBeforeTailSeparatorsCount) * this.thousandsSeparator.length;
        appendDetails.skip = !appendDetails.rawInserted && ch === this.thousandsSeparator;
        return appendDetails;
      }
      /** */

    }, {
      key: "_findSeparatorAround",
      value: function _findSeparatorAround(pos) {
        if (this.thousandsSeparator) {
          var searchFrom = pos - this.thousandsSeparator.length + 1;
          var separatorPos = this.value.indexOf(this.thousandsSeparator, searchFrom);
          if (separatorPos <= pos) return separatorPos;
        }

        return -1;
      }
    }, {
      key: "_adjustRangeWithSeparators",
      value: function _adjustRangeWithSeparators(from, to) {
        var separatorAroundFromPos = this._findSeparatorAround(from);

        if (separatorAroundFromPos >= 0) from = separatorAroundFromPos;

        var separatorAroundToPos = this._findSeparatorAround(to);

        if (separatorAroundToPos >= 0) to = separatorAroundToPos + this.thousandsSeparator.length;
        return [from, to];
      }
      /**
        @override
      */

    }, {
      key: "remove",
      value: function remove() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;

        var _this$_adjustRangeWit3 = this._adjustRangeWithSeparators(fromPos, toPos);

        var _this$_adjustRangeWit4 = _slicedToArray$1(_this$_adjustRangeWit3, 2);

        fromPos = _this$_adjustRangeWit4[0];
        toPos = _this$_adjustRangeWit4[1];
        var valueBeforePos = this.value.slice(0, fromPos);
        var valueAfterPos = this.value.slice(toPos);

        var prevBeforeTailSeparatorsCount = this._separatorsCount(valueBeforePos.length);

        this._value = this._insertThousandsSeparators(this._removeThousandsSeparators(valueBeforePos + valueAfterPos));

        var beforeTailSeparatorsCount = this._separatorsCountFromSlice(valueBeforePos);

        return new ChangeDetails({
          tailShift: (beforeTailSeparatorsCount - prevBeforeTailSeparatorsCount) * this.thousandsSeparator.length
        });
      }
      /**
        @override
      */

    }, {
      key: "nearestInputPos",
      value: function nearestInputPos(cursorPos, direction) {
        if (!this.thousandsSeparator) return cursorPos;

        switch (direction) {
          case DIRECTION.NONE:
          case DIRECTION.LEFT:
          case DIRECTION.FORCE_LEFT:
            {
              var separatorAtLeftPos = this._findSeparatorAround(cursorPos - 1);

              if (separatorAtLeftPos >= 0) {
                var separatorAtLeftEndPos = separatorAtLeftPos + this.thousandsSeparator.length;

                if (cursorPos < separatorAtLeftEndPos || this.value.length <= separatorAtLeftEndPos || direction === DIRECTION.FORCE_LEFT) {
                  return separatorAtLeftPos;
                }
              }

              break;
            }

          case DIRECTION.RIGHT:
          case DIRECTION.FORCE_RIGHT:
            {
              var separatorAtRightPos = this._findSeparatorAround(cursorPos);

              if (separatorAtRightPos >= 0) {
                return separatorAtRightPos + this.thousandsSeparator.length;
              }
            }
        }

        return cursorPos;
      }
      /**
        @override
      */

    }, {
      key: "doValidate",
      value: function doValidate(flags) {
        var regexp = flags.input ? this._numberRegExpInput : this._numberRegExp; // validate as string

        var valid = regexp.test(this._removeThousandsSeparators(this.value));

        if (valid) {
          // validate as number
          var number = this.number;
          valid = valid && !isNaN(number) && (this.min == null || this.min >= 0 || this.min <= this.number) && (this.max == null || this.max <= 0 || this.number <= this.max);
        }

        return valid && _get$1(_getPrototypeOf$1(MaskedNumber.prototype), "doValidate", this).call(this, flags);
      }
      /**
        @override
      */

    }, {
      key: "doCommit",
      value: function doCommit() {
        if (this.value) {
          var number = this.number;
          var validnum = number; // check bounds

          if (this.min != null) validnum = Math.max(validnum, this.min);
          if (this.max != null) validnum = Math.min(validnum, this.max);
          if (validnum !== number) this.unmaskedValue = String(validnum);
          var formatted = this.value;
          if (this.normalizeZeros) formatted = this._normalizeZeros(formatted);
          if (this.padFractionalZeros) formatted = this._padFractionalZeros(formatted);
          this._value = formatted;
        }

        _get$1(_getPrototypeOf$1(MaskedNumber.prototype), "doCommit", this).call(this);
      }
      /** */

    }, {
      key: "_normalizeZeros",
      value: function _normalizeZeros(value) {
        var parts = this._removeThousandsSeparators(value).split(this.radix); // remove leading zeros


        parts[0] = parts[0].replace(/^(\D*)(0*)(\d*)/, function (match, sign, zeros, num) {
          return sign + num;
        }); // add leading zero

        if (value.length && !/\d$/.test(parts[0])) parts[0] = parts[0] + '0';

        if (parts.length > 1) {
          parts[1] = parts[1].replace(/0*$/, ''); // remove trailing zeros

          if (!parts[1].length) parts.length = 1; // remove fractional
        }

        return this._insertThousandsSeparators(parts.join(this.radix));
      }
      /** */

    }, {
      key: "_padFractionalZeros",
      value: function _padFractionalZeros(value) {
        if (!value) return value;
        var parts = value.split(this.radix);
        if (parts.length < 2) parts.push('');
        parts[1] = parts[1].padEnd(this.scale, '0');
        return parts.join(this.radix);
      }
      /**
        @override
      */

    }, {
      key: "unmaskedValue",
      get: function get() {
        return this._removeThousandsSeparators(this._normalizeZeros(this.value)).replace(this.radix, '.');
      },
      set: function set(unmaskedValue) {
        _set(_getPrototypeOf$1(MaskedNumber.prototype), "unmaskedValue", unmaskedValue.replace('.', this.radix), this, true);
      }
      /**
        @override
      */

    }, {
      key: "typedValue",
      get: function get() {
        return Number(this.unmaskedValue);
      },
      set: function set(n) {
        _set(_getPrototypeOf$1(MaskedNumber.prototype), "unmaskedValue", String(n), this, true);
      }
      /** Parsed Number */

    }, {
      key: "number",
      get: function get() {
        return this.typedValue;
      },
      set: function set(number) {
        this.typedValue = number;
      }
      /**
        Is negative allowed
        @readonly
      */

    }, {
      key: "allowNegative",
      get: function get() {
        return this.signed || this.min != null && this.min < 0 || this.max != null && this.max < 0;
      }
    }]);

    return MaskedNumber;
  }(Masked);
  MaskedNumber.DEFAULTS = {
    radix: ',',
    thousandsSeparator: '',
    mapToRadix: ['.'],
    scale: 2,
    signed: false,
    normalizeZeros: true,
    padFractionalZeros: false
  };
  IMask$1.MaskedNumber = MaskedNumber;

  /** Masking by custom Function */

  var MaskedFunction = /*#__PURE__*/function (_Masked) {
    _inherits$1(MaskedFunction, _Masked);

    var _super = _createSuper$1(MaskedFunction);

    function MaskedFunction() {
      _classCallCheck$1(this, MaskedFunction);

      return _super.apply(this, arguments);
    }

    _createClass$1(MaskedFunction, [{
      key: "_update",
      value:
      /**
        @override
        @param {Object} opts
      */
      function _update(opts) {
        if (opts.mask) opts.validate = opts.mask;

        _get$1(_getPrototypeOf$1(MaskedFunction.prototype), "_update", this).call(this, opts);
      }
    }]);

    return MaskedFunction;
  }(Masked);
  IMask$1.MaskedFunction = MaskedFunction;

  var _excluded$4 = ["compiledMasks", "currentMaskRef", "currentMask"];

  /** Dynamic mask for choosing apropriate mask in run-time */
  var MaskedDynamic = /*#__PURE__*/function (_Masked) {
    _inherits$1(MaskedDynamic, _Masked);

    var _super = _createSuper$1(MaskedDynamic);

    /** Currently chosen mask */

    /** Compliled {@link Masked} options */

    /** Chooses {@link Masked} depending on input value */

    /**
      @param {Object} opts
    */
    function MaskedDynamic(opts) {
      var _this;

      _classCallCheck$1(this, MaskedDynamic);

      _this = _super.call(this, Object.assign({}, MaskedDynamic.DEFAULTS, opts));
      _this.currentMask = null;
      return _this;
    }
    /**
      @override
    */


    _createClass$1(MaskedDynamic, [{
      key: "_update",
      value: function _update(opts) {
        _get$1(_getPrototypeOf$1(MaskedDynamic.prototype), "_update", this).call(this, opts);

        if ('mask' in opts) {
          // mask could be totally dynamic with only `dispatch` option
          this.compiledMasks = Array.isArray(opts.mask) ? opts.mask.map(function (m) {
            return createMask(m);
          }) : [];
        }
      }
      /**
        @override
      */

    }, {
      key: "_appendCharRaw",
      value: function _appendCharRaw(ch) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var details = this._applyDispatch(ch, flags);

        if (this.currentMask) {
          details.aggregate(this.currentMask._appendChar(ch, flags));
        }

        return details;
      }
    }, {
      key: "_applyDispatch",
      value: function _applyDispatch() {
        var appended = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var prevValueBeforeTail = flags.tail && flags._beforeTailState != null ? flags._beforeTailState._value : this.value;
        var inputValue = this.rawInputValue;
        var insertValue = flags.tail && flags._beforeTailState != null ? // $FlowFixMe - tired to fight with type system
        flags._beforeTailState._rawInputValue : inputValue;
        var tailValue = inputValue.slice(insertValue.length);
        var prevMask = this.currentMask;
        var details = new ChangeDetails();
        var prevMaskState = prevMask && prevMask.state; // clone flags to prevent overwriting `_beforeTailState`

        this.currentMask = this.doDispatch(appended, Object.assign({}, flags)); // restore state after dispatch

        if (this.currentMask) {
          if (this.currentMask !== prevMask) {
            // if mask changed reapply input
            this.currentMask.reset();

            if (insertValue) {
              // $FlowFixMe - it's ok, we don't change current mask above
              var d = this.currentMask.append(insertValue, {
                raw: true
              });
              details.tailShift = d.inserted.length - prevValueBeforeTail.length;
            }

            if (tailValue) {
              // $FlowFixMe - it's ok, we don't change current mask above
              details.tailShift += this.currentMask.append(tailValue, {
                raw: true,
                tail: true
              }).tailShift;
            }
          } else {
            // Dispatch can do something bad with state, so
            // restore prev mask state
            this.currentMask.state = prevMaskState;
          }
        }

        return details;
      }
    }, {
      key: "_appendPlaceholder",
      value: function _appendPlaceholder() {
        var details = this._applyDispatch.apply(this, arguments);

        if (this.currentMask) {
          details.aggregate(this.currentMask._appendPlaceholder());
        }

        return details;
      }
      /**
        @override
      */

    }, {
      key: "doDispatch",
      value: function doDispatch(appended) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        return this.dispatch(appended, this, flags);
      }
      /**
        @override
      */

    }, {
      key: "doValidate",
      value: function doValidate() {
        var _get2, _this$currentMask;

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return (_get2 = _get$1(_getPrototypeOf$1(MaskedDynamic.prototype), "doValidate", this)).call.apply(_get2, [this].concat(args)) && (!this.currentMask || (_this$currentMask = this.currentMask).doValidate.apply(_this$currentMask, args));
      }
      /**
        @override
      */

    }, {
      key: "reset",
      value: function reset() {
        if (this.currentMask) this.currentMask.reset();
        this.compiledMasks.forEach(function (m) {
          return m.reset();
        });
      }
      /**
        @override
      */

    }, {
      key: "value",
      get: function get() {
        return this.currentMask ? this.currentMask.value : '';
      },
      set: function set(value) {
        _set(_getPrototypeOf$1(MaskedDynamic.prototype), "value", value, this, true);
      }
      /**
        @override
      */

    }, {
      key: "unmaskedValue",
      get: function get() {
        return this.currentMask ? this.currentMask.unmaskedValue : '';
      },
      set: function set(unmaskedValue) {
        _set(_getPrototypeOf$1(MaskedDynamic.prototype), "unmaskedValue", unmaskedValue, this, true);
      }
      /**
        @override
      */

    }, {
      key: "typedValue",
      get: function get() {
        return this.currentMask ? this.currentMask.typedValue : '';
      } // probably typedValue should not be used with dynamic
      ,
      set: function set(value) {
        var unmaskedValue = String(value); // double check it

        if (this.currentMask) {
          this.currentMask.typedValue = value;
          unmaskedValue = this.currentMask.unmaskedValue;
        }

        this.unmaskedValue = unmaskedValue;
      }
      /**
        @override
      */

    }, {
      key: "isComplete",
      get: function get() {
        return !!this.currentMask && this.currentMask.isComplete;
      }
      /**
        @override
      */

    }, {
      key: "remove",
      value: function remove() {
        var details = new ChangeDetails();

        if (this.currentMask) {
          var _this$currentMask2;

          details.aggregate((_this$currentMask2 = this.currentMask).remove.apply(_this$currentMask2, arguments)) // update with dispatch
          .aggregate(this._applyDispatch());
        }

        return details;
      }
      /**
        @override
      */

    }, {
      key: "state",
      get: function get() {
        return Object.assign({}, _get$1(_getPrototypeOf$1(MaskedDynamic.prototype), "state", this), {
          _rawInputValue: this.rawInputValue,
          compiledMasks: this.compiledMasks.map(function (m) {
            return m.state;
          }),
          currentMaskRef: this.currentMask,
          currentMask: this.currentMask && this.currentMask.state
        });
      },
      set: function set(state) {
        var compiledMasks = state.compiledMasks,
            currentMaskRef = state.currentMaskRef,
            currentMask = state.currentMask,
            maskedState = _objectWithoutProperties(state, _excluded$4);

        this.compiledMasks.forEach(function (m, mi) {
          return m.state = compiledMasks[mi];
        });

        if (currentMaskRef != null) {
          this.currentMask = currentMaskRef;
          this.currentMask.state = currentMask;
        }

        _set(_getPrototypeOf$1(MaskedDynamic.prototype), "state", maskedState, this, true);
      }
      /**
        @override
      */

    }, {
      key: "extractInput",
      value: function extractInput() {
        var _this$currentMask3;

        return this.currentMask ? (_this$currentMask3 = this.currentMask).extractInput.apply(_this$currentMask3, arguments) : '';
      }
      /**
        @override
      */

    }, {
      key: "extractTail",
      value: function extractTail() {
        var _this$currentMask4, _get3;

        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }

        return this.currentMask ? (_this$currentMask4 = this.currentMask).extractTail.apply(_this$currentMask4, args) : (_get3 = _get$1(_getPrototypeOf$1(MaskedDynamic.prototype), "extractTail", this)).call.apply(_get3, [this].concat(args));
      }
      /**
        @override
      */

    }, {
      key: "doCommit",
      value: function doCommit() {
        if (this.currentMask) this.currentMask.doCommit();

        _get$1(_getPrototypeOf$1(MaskedDynamic.prototype), "doCommit", this).call(this);
      }
      /**
        @override
      */

    }, {
      key: "nearestInputPos",
      value: function nearestInputPos() {
        var _this$currentMask5, _get4;

        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }

        return this.currentMask ? (_this$currentMask5 = this.currentMask).nearestInputPos.apply(_this$currentMask5, args) : (_get4 = _get$1(_getPrototypeOf$1(MaskedDynamic.prototype), "nearestInputPos", this)).call.apply(_get4, [this].concat(args));
      }
    }, {
      key: "overwrite",
      get: function get() {
        return this.currentMask ? this.currentMask.overwrite : _get$1(_getPrototypeOf$1(MaskedDynamic.prototype), "overwrite", this);
      },
      set: function set(overwrite) {
        console.warn('"overwrite" option is not available in dynamic mask, use this option in siblings');
      }
    }]);

    return MaskedDynamic;
  }(Masked);
  MaskedDynamic.DEFAULTS = {
    dispatch: function dispatch(appended, masked, flags) {
      if (!masked.compiledMasks.length) return;
      var inputValue = masked.rawInputValue; // simulate input

      var inputs = masked.compiledMasks.map(function (m, index) {
        m.reset();
        m.append(inputValue, {
          raw: true
        });
        m.append(appended, flags);
        var weight = m.rawInputValue.length;
        return {
          weight: weight,
          index: index
        };
      }); // pop masks with longer values first

      inputs.sort(function (i1, i2) {
        return i2.weight - i1.weight;
      });
      return masked.compiledMasks[inputs[0].index];
    }
  };
  IMask$1.MaskedDynamic = MaskedDynamic;

  /** Mask pipe source and destination types */

  var PIPE_TYPE = {
    MASKED: 'value',
    UNMASKED: 'unmaskedValue',
    TYPED: 'typedValue'
  };
  /** Creates new pipe function depending on mask type, source and destination options */

  function createPipe(mask) {
    var from = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : PIPE_TYPE.MASKED;
    var to = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : PIPE_TYPE.MASKED;
    var masked = createMask(mask);
    return function (value) {
      return masked.runIsolated(function (m) {
        m[from] = value;
        return m[to];
      });
    };
  }
  /** Pipes value through mask depending on mask type, source and destination options */

  function pipe(value) {
    for (var _len = arguments.length, pipeArgs = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      pipeArgs[_key - 1] = arguments[_key];
    }

    return createPipe.apply(void 0, pipeArgs)(value);
  }
  IMask$1.PIPE_TYPE = PIPE_TYPE;
  IMask$1.createPipe = createPipe;
  IMask$1.pipe = pipe;

  try {
    globalThis.IMask = IMask$1;
  } catch (e) {}

  var commonjsGlobal$1 = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule$1(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var check = function (it) {
    return it && it.Math == Math && it;
  };

  // https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
  var global_1 =
    // eslint-disable-next-line es/no-global-this -- safe
    check(typeof globalThis == 'object' && globalThis) ||
    check(typeof window == 'object' && window) ||
    // eslint-disable-next-line no-restricted-globals -- safe
    check(typeof self == 'object' && self) ||
    check(typeof commonjsGlobal$1 == 'object' && commonjsGlobal$1) ||
    // eslint-disable-next-line no-new-func -- fallback
    (function () { return this; })() || Function('return this')();

  var fails = function (exec) {
    try {
      return !!exec();
    } catch (error) {
      return true;
    }
  };

  // Detect IE8's incomplete defineProperty implementation
  var descriptors = !fails(function () {
    // eslint-disable-next-line es/no-object-defineproperty -- required for testing
    return Object.defineProperty({}, 1, { get: function () { return 7; } })[1] != 7;
  });

  var call = Function.prototype.call;

  var functionCall = call.bind ? call.bind(call) : function () {
    return call.apply(call, arguments);
  };

  var $propertyIsEnumerable = {}.propertyIsEnumerable;
  // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
  var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

  // Nashorn ~ JDK8 bug
  var NASHORN_BUG = getOwnPropertyDescriptor && !$propertyIsEnumerable.call({ 1: 2 }, 1);

  // `Object.prototype.propertyIsEnumerable` method implementation
  // https://tc39.es/ecma262/#sec-object.prototype.propertyisenumerable
  var f = NASHORN_BUG ? function propertyIsEnumerable(V) {
    var descriptor = getOwnPropertyDescriptor(this, V);
    return !!descriptor && descriptor.enumerable;
  } : $propertyIsEnumerable;

  var objectPropertyIsEnumerable = {
  	f: f
  };

  var createPropertyDescriptor = function (bitmap, value) {
    return {
      enumerable: !(bitmap & 1),
      configurable: !(bitmap & 2),
      writable: !(bitmap & 4),
      value: value
    };
  };

  var FunctionPrototype = Function.prototype;
  var bind$1 = FunctionPrototype.bind;
  var call$1 = FunctionPrototype.call;
  var callBind = bind$1 && bind$1.bind(call$1);

  var functionUncurryThis = bind$1 ? function (fn) {
    return fn && callBind(call$1, fn);
  } : function (fn) {
    return fn && function () {
      return call$1.apply(fn, arguments);
    };
  };

  var toString$1 = functionUncurryThis({}.toString);
  var stringSlice = functionUncurryThis(''.slice);

  var classofRaw = function (it) {
    return stringSlice(toString$1(it), 8, -1);
  };

  var Object$1 = global_1.Object;
  var split = functionUncurryThis(''.split);

  // fallback for non-array-like ES3 and non-enumerable old V8 strings
  var indexedObject = fails(function () {
    // throws an error in rhino, see https://github.com/mozilla/rhino/issues/346
    // eslint-disable-next-line no-prototype-builtins -- safe
    return !Object$1('z').propertyIsEnumerable(0);
  }) ? function (it) {
    return classofRaw(it) == 'String' ? split(it, '') : Object$1(it);
  } : Object$1;

  var TypeError$1 = global_1.TypeError;

  // `RequireObjectCoercible` abstract operation
  // https://tc39.es/ecma262/#sec-requireobjectcoercible
  var requireObjectCoercible = function (it) {
    if (it == undefined) throw TypeError$1("Can't call method on " + it);
    return it;
  };

  // toObject with fallback for non-array-like ES3 strings



  var toIndexedObject = function (it) {
    return indexedObject(requireObjectCoercible(it));
  };

  // `IsCallable` abstract operation
  // https://tc39.es/ecma262/#sec-iscallable
  var isCallable = function (argument) {
    return typeof argument == 'function';
  };

  var isObject = function (it) {
    return typeof it == 'object' ? it !== null : isCallable(it);
  };

  var aFunction = function (argument) {
    return isCallable(argument) ? argument : undefined;
  };

  var getBuiltIn = function (namespace, method) {
    return arguments.length < 2 ? aFunction(global_1[namespace]) : global_1[namespace] && global_1[namespace][method];
  };

  var objectIsPrototypeOf = functionUncurryThis({}.isPrototypeOf);

  var engineUserAgent = getBuiltIn('navigator', 'userAgent') || '';

  var process = global_1.process;
  var Deno = global_1.Deno;
  var versions = process && process.versions || Deno && Deno.version;
  var v8 = versions && versions.v8;
  var match, version;

  if (v8) {
    match = v8.split('.');
    // in old Chrome, versions of V8 isn't V8 = Chrome / 10
    // but their correct versions are not interesting for us
    version = match[0] > 0 && match[0] < 4 ? 1 : +(match[0] + match[1]);
  }

  // BrowserFS NodeJS `process` polyfill incorrectly set `.v8` to `0.0`
  // so check `userAgent` even if `.v8` exists, but 0
  if (!version && engineUserAgent) {
    match = engineUserAgent.match(/Edge\/(\d+)/);
    if (!match || match[1] >= 74) {
      match = engineUserAgent.match(/Chrome\/(\d+)/);
      if (match) version = +match[1];
    }
  }

  var engineV8Version = version;

  /* eslint-disable es/no-symbol -- required for testing */



  // eslint-disable-next-line es/no-object-getownpropertysymbols -- required for testing
  var nativeSymbol = !!Object.getOwnPropertySymbols && !fails(function () {
    var symbol = Symbol();
    // Chrome 38 Symbol has incorrect toString conversion
    // `get-own-property-symbols` polyfill symbols converted to object are not Symbol instances
    return !String(symbol) || !(Object(symbol) instanceof Symbol) ||
      // Chrome 38-40 symbols are not inherited from DOM collections prototypes to instances
      !Symbol.sham && engineV8Version && engineV8Version < 41;
  });

  /* eslint-disable es/no-symbol -- required for testing */


  var useSymbolAsUid = nativeSymbol
    && !Symbol.sham
    && typeof Symbol.iterator == 'symbol';

  var Object$2 = global_1.Object;

  var isSymbol = useSymbolAsUid ? function (it) {
    return typeof it == 'symbol';
  } : function (it) {
    var $Symbol = getBuiltIn('Symbol');
    return isCallable($Symbol) && objectIsPrototypeOf($Symbol.prototype, Object$2(it));
  };

  var String$1 = global_1.String;

  var tryToString = function (argument) {
    try {
      return String$1(argument);
    } catch (error) {
      return 'Object';
    }
  };

  var TypeError$2 = global_1.TypeError;

  // `Assert: IsCallable(argument) is true`
  var aCallable = function (argument) {
    if (isCallable(argument)) return argument;
    throw TypeError$2(tryToString(argument) + ' is not a function');
  };

  // `GetMethod` abstract operation
  // https://tc39.es/ecma262/#sec-getmethod
  var getMethod = function (V, P) {
    var func = V[P];
    return func == null ? undefined : aCallable(func);
  };

  var TypeError$3 = global_1.TypeError;

  // `OrdinaryToPrimitive` abstract operation
  // https://tc39.es/ecma262/#sec-ordinarytoprimitive
  var ordinaryToPrimitive = function (input, pref) {
    var fn, val;
    if (pref === 'string' && isCallable(fn = input.toString) && !isObject(val = functionCall(fn, input))) return val;
    if (isCallable(fn = input.valueOf) && !isObject(val = functionCall(fn, input))) return val;
    if (pref !== 'string' && isCallable(fn = input.toString) && !isObject(val = functionCall(fn, input))) return val;
    throw TypeError$3("Can't convert object to primitive value");
  };

  // eslint-disable-next-line es/no-object-defineproperty -- safe
  var defineProperty = Object.defineProperty;

  var setGlobal = function (key, value) {
    try {
      defineProperty(global_1, key, { value: value, configurable: true, writable: true });
    } catch (error) {
      global_1[key] = value;
    } return value;
  };

  var SHARED = '__core-js_shared__';
  var store = global_1[SHARED] || setGlobal(SHARED, {});

  var sharedStore = store;

  var shared = createCommonjsModule$1(function (module) {
  (module.exports = function (key, value) {
    return sharedStore[key] || (sharedStore[key] = value !== undefined ? value : {});
  })('versions', []).push({
    version: '3.19.3',
    mode:  'global',
    copyright: '© 2021 Denis Pushkarev (zloirock.ru)'
  });
  });

  var Object$3 = global_1.Object;

  // `ToObject` abstract operation
  // https://tc39.es/ecma262/#sec-toobject
  var toObject$1 = function (argument) {
    return Object$3(requireObjectCoercible(argument));
  };

  var hasOwnProperty$2 = functionUncurryThis({}.hasOwnProperty);

  // `HasOwnProperty` abstract operation
  // https://tc39.es/ecma262/#sec-hasownproperty
  var hasOwnProperty_1 = Object.hasOwn || function hasOwn(it, key) {
    return hasOwnProperty$2(toObject$1(it), key);
  };

  var id = 0;
  var postfix = Math.random();
  var toString$2 = functionUncurryThis(1.0.toString);

  var uid = function (key) {
    return 'Symbol(' + (key === undefined ? '' : key) + ')_' + toString$2(++id + postfix, 36);
  };

  var WellKnownSymbolsStore = shared('wks');
  var Symbol$1 = global_1.Symbol;
  var symbolFor = Symbol$1 && Symbol$1['for'];
  var createWellKnownSymbol = useSymbolAsUid ? Symbol$1 : Symbol$1 && Symbol$1.withoutSetter || uid;

  var wellKnownSymbol = function (name) {
    if (!hasOwnProperty_1(WellKnownSymbolsStore, name) || !(nativeSymbol || typeof WellKnownSymbolsStore[name] == 'string')) {
      var description = 'Symbol.' + name;
      if (nativeSymbol && hasOwnProperty_1(Symbol$1, name)) {
        WellKnownSymbolsStore[name] = Symbol$1[name];
      } else if (useSymbolAsUid && symbolFor) {
        WellKnownSymbolsStore[name] = symbolFor(description);
      } else {
        WellKnownSymbolsStore[name] = createWellKnownSymbol(description);
      }
    } return WellKnownSymbolsStore[name];
  };

  var TypeError$4 = global_1.TypeError;
  var TO_PRIMITIVE = wellKnownSymbol('toPrimitive');

  // `ToPrimitive` abstract operation
  // https://tc39.es/ecma262/#sec-toprimitive
  var toPrimitive = function (input, pref) {
    if (!isObject(input) || isSymbol(input)) return input;
    var exoticToPrim = getMethod(input, TO_PRIMITIVE);
    var result;
    if (exoticToPrim) {
      if (pref === undefined) pref = 'default';
      result = functionCall(exoticToPrim, input, pref);
      if (!isObject(result) || isSymbol(result)) return result;
      throw TypeError$4("Can't convert object to primitive value");
    }
    if (pref === undefined) pref = 'number';
    return ordinaryToPrimitive(input, pref);
  };

  // `ToPropertyKey` abstract operation
  // https://tc39.es/ecma262/#sec-topropertykey
  var toPropertyKey = function (argument) {
    var key = toPrimitive(argument, 'string');
    return isSymbol(key) ? key : key + '';
  };

  var document$1 = global_1.document;
  // typeof document.createElement is 'object' in old IE
  var EXISTS = isObject(document$1) && isObject(document$1.createElement);

  var documentCreateElement = function (it) {
    return EXISTS ? document$1.createElement(it) : {};
  };

  // Thank's IE8 for his funny defineProperty
  var ie8DomDefine = !descriptors && !fails(function () {
    // eslint-disable-next-line es/no-object-defineproperty -- requied for testing
    return Object.defineProperty(documentCreateElement('div'), 'a', {
      get: function () { return 7; }
    }).a != 7;
  });

  // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
  var $getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

  // `Object.getOwnPropertyDescriptor` method
  // https://tc39.es/ecma262/#sec-object.getownpropertydescriptor
  var f$1 = descriptors ? $getOwnPropertyDescriptor : function getOwnPropertyDescriptor(O, P) {
    O = toIndexedObject(O);
    P = toPropertyKey(P);
    if (ie8DomDefine) try {
      return $getOwnPropertyDescriptor(O, P);
    } catch (error) { /* empty */ }
    if (hasOwnProperty_1(O, P)) return createPropertyDescriptor(!functionCall(objectPropertyIsEnumerable.f, O, P), O[P]);
  };

  var objectGetOwnPropertyDescriptor = {
  	f: f$1
  };

  var String$2 = global_1.String;
  var TypeError$5 = global_1.TypeError;

  // `Assert: Type(argument) is Object`
  var anObject = function (argument) {
    if (isObject(argument)) return argument;
    throw TypeError$5(String$2(argument) + ' is not an object');
  };

  var TypeError$6 = global_1.TypeError;
  // eslint-disable-next-line es/no-object-defineproperty -- safe
  var $defineProperty = Object.defineProperty;

  // `Object.defineProperty` method
  // https://tc39.es/ecma262/#sec-object.defineproperty
  var f$2 = descriptors ? $defineProperty : function defineProperty(O, P, Attributes) {
    anObject(O);
    P = toPropertyKey(P);
    anObject(Attributes);
    if (ie8DomDefine) try {
      return $defineProperty(O, P, Attributes);
    } catch (error) { /* empty */ }
    if ('get' in Attributes || 'set' in Attributes) throw TypeError$6('Accessors not supported');
    if ('value' in Attributes) O[P] = Attributes.value;
    return O;
  };

  var objectDefineProperty = {
  	f: f$2
  };

  var createNonEnumerableProperty = descriptors ? function (object, key, value) {
    return objectDefineProperty.f(object, key, createPropertyDescriptor(1, value));
  } : function (object, key, value) {
    object[key] = value;
    return object;
  };

  var functionToString = functionUncurryThis(Function.toString);

  // this helper broken in `core-js@3.4.1-3.4.4`, so we can't use `shared` helper
  if (!isCallable(sharedStore.inspectSource)) {
    sharedStore.inspectSource = function (it) {
      return functionToString(it);
    };
  }

  var inspectSource = sharedStore.inspectSource;

  var WeakMap$1 = global_1.WeakMap;

  var nativeWeakMap = isCallable(WeakMap$1) && /native code/.test(inspectSource(WeakMap$1));

  var keys = shared('keys');

  var sharedKey = function (key) {
    return keys[key] || (keys[key] = uid(key));
  };

  var hiddenKeys = {};

  var OBJECT_ALREADY_INITIALIZED = 'Object already initialized';
  var TypeError$7 = global_1.TypeError;
  var WeakMap$2 = global_1.WeakMap;
  var set$1, get, has;

  var enforce = function (it) {
    return has(it) ? get(it) : set$1(it, {});
  };

  var getterFor = function (TYPE) {
    return function (it) {
      var state;
      if (!isObject(it) || (state = get(it)).type !== TYPE) {
        throw TypeError$7('Incompatible receiver, ' + TYPE + ' required');
      } return state;
    };
  };

  if (nativeWeakMap || sharedStore.state) {
    var store$1 = sharedStore.state || (sharedStore.state = new WeakMap$2());
    var wmget = functionUncurryThis(store$1.get);
    var wmhas = functionUncurryThis(store$1.has);
    var wmset = functionUncurryThis(store$1.set);
    set$1 = function (it, metadata) {
      if (wmhas(store$1, it)) throw new TypeError$7(OBJECT_ALREADY_INITIALIZED);
      metadata.facade = it;
      wmset(store$1, it, metadata);
      return metadata;
    };
    get = function (it) {
      return wmget(store$1, it) || {};
    };
    has = function (it) {
      return wmhas(store$1, it);
    };
  } else {
    var STATE = sharedKey('state');
    hiddenKeys[STATE] = true;
    set$1 = function (it, metadata) {
      if (hasOwnProperty_1(it, STATE)) throw new TypeError$7(OBJECT_ALREADY_INITIALIZED);
      metadata.facade = it;
      createNonEnumerableProperty(it, STATE, metadata);
      return metadata;
    };
    get = function (it) {
      return hasOwnProperty_1(it, STATE) ? it[STATE] : {};
    };
    has = function (it) {
      return hasOwnProperty_1(it, STATE);
    };
  }

  var internalState = {
    set: set$1,
    get: get,
    has: has,
    enforce: enforce,
    getterFor: getterFor
  };

  var FunctionPrototype$1 = Function.prototype;
  // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
  var getDescriptor = descriptors && Object.getOwnPropertyDescriptor;

  var EXISTS$1 = hasOwnProperty_1(FunctionPrototype$1, 'name');
  // additional protection from minified / mangled / dropped function names
  var PROPER = EXISTS$1 && (function something() { /* empty */ }).name === 'something';
  var CONFIGURABLE = EXISTS$1 && (!descriptors || (descriptors && getDescriptor(FunctionPrototype$1, 'name').configurable));

  var functionName = {
    EXISTS: EXISTS$1,
    PROPER: PROPER,
    CONFIGURABLE: CONFIGURABLE
  };

  var redefine = createCommonjsModule$1(function (module) {
  var CONFIGURABLE_FUNCTION_NAME = functionName.CONFIGURABLE;

  var getInternalState = internalState.get;
  var enforceInternalState = internalState.enforce;
  var TEMPLATE = String(String).split('String');

  (module.exports = function (O, key, value, options) {
    var unsafe = options ? !!options.unsafe : false;
    var simple = options ? !!options.enumerable : false;
    var noTargetGet = options ? !!options.noTargetGet : false;
    var name = options && options.name !== undefined ? options.name : key;
    var state;
    if (isCallable(value)) {
      if (String(name).slice(0, 7) === 'Symbol(') {
        name = '[' + String(name).replace(/^Symbol\(([^)]*)\)/, '$1') + ']';
      }
      if (!hasOwnProperty_1(value, 'name') || (CONFIGURABLE_FUNCTION_NAME && value.name !== name)) {
        createNonEnumerableProperty(value, 'name', name);
      }
      state = enforceInternalState(value);
      if (!state.source) {
        state.source = TEMPLATE.join(typeof name == 'string' ? name : '');
      }
    }
    if (O === global_1) {
      if (simple) O[key] = value;
      else setGlobal(key, value);
      return;
    } else if (!unsafe) {
      delete O[key];
    } else if (!noTargetGet && O[key]) {
      simple = true;
    }
    if (simple) O[key] = value;
    else createNonEnumerableProperty(O, key, value);
  // add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
  })(Function.prototype, 'toString', function toString() {
    return isCallable(this) && getInternalState(this).source || inspectSource(this);
  });
  });

  var ceil = Math.ceil;
  var floor = Math.floor;

  // `ToIntegerOrInfinity` abstract operation
  // https://tc39.es/ecma262/#sec-tointegerorinfinity
  var toIntegerOrInfinity = function (argument) {
    var number = +argument;
    // eslint-disable-next-line no-self-compare -- safe
    return number !== number || number === 0 ? 0 : (number > 0 ? floor : ceil)(number);
  };

  var max = Math.max;
  var min = Math.min;

  // Helper for a popular repeating case of the spec:
  // Let integer be ? ToInteger(index).
  // If integer < 0, let result be max((length + integer), 0); else let result be min(integer, length).
  var toAbsoluteIndex = function (index, length) {
    var integer = toIntegerOrInfinity(index);
    return integer < 0 ? max(integer + length, 0) : min(integer, length);
  };

  var min$1 = Math.min;

  // `ToLength` abstract operation
  // https://tc39.es/ecma262/#sec-tolength
  var toLength = function (argument) {
    return argument > 0 ? min$1(toIntegerOrInfinity(argument), 0x1FFFFFFFFFFFFF) : 0; // 2 ** 53 - 1 == 9007199254740991
  };

  // `LengthOfArrayLike` abstract operation
  // https://tc39.es/ecma262/#sec-lengthofarraylike
  var lengthOfArrayLike = function (obj) {
    return toLength(obj.length);
  };

  // `Array.prototype.{ indexOf, includes }` methods implementation
  var createMethod = function (IS_INCLUDES) {
    return function ($this, el, fromIndex) {
      var O = toIndexedObject($this);
      var length = lengthOfArrayLike(O);
      var index = toAbsoluteIndex(fromIndex, length);
      var value;
      // Array#includes uses SameValueZero equality algorithm
      // eslint-disable-next-line no-self-compare -- NaN check
      if (IS_INCLUDES && el != el) while (length > index) {
        value = O[index++];
        // eslint-disable-next-line no-self-compare -- NaN check
        if (value != value) return true;
      // Array#indexOf ignores holes, Array#includes - not
      } else for (;length > index; index++) {
        if ((IS_INCLUDES || index in O) && O[index] === el) return IS_INCLUDES || index || 0;
      } return !IS_INCLUDES && -1;
    };
  };

  var arrayIncludes = {
    // `Array.prototype.includes` method
    // https://tc39.es/ecma262/#sec-array.prototype.includes
    includes: createMethod(true),
    // `Array.prototype.indexOf` method
    // https://tc39.es/ecma262/#sec-array.prototype.indexof
    indexOf: createMethod(false)
  };

  var indexOf = arrayIncludes.indexOf;


  var push = functionUncurryThis([].push);

  var objectKeysInternal = function (object, names) {
    var O = toIndexedObject(object);
    var i = 0;
    var result = [];
    var key;
    for (key in O) !hasOwnProperty_1(hiddenKeys, key) && hasOwnProperty_1(O, key) && push(result, key);
    // Don't enum bug & hidden keys
    while (names.length > i) if (hasOwnProperty_1(O, key = names[i++])) {
      ~indexOf(result, key) || push(result, key);
    }
    return result;
  };

  // IE8- don't enum bug keys
  var enumBugKeys = [
    'constructor',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    'toString',
    'valueOf'
  ];

  var hiddenKeys$1 = enumBugKeys.concat('length', 'prototype');

  // `Object.getOwnPropertyNames` method
  // https://tc39.es/ecma262/#sec-object.getownpropertynames
  // eslint-disable-next-line es/no-object-getownpropertynames -- safe
  var f$3 = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
    return objectKeysInternal(O, hiddenKeys$1);
  };

  var objectGetOwnPropertyNames = {
  	f: f$3
  };

  // eslint-disable-next-line es/no-object-getownpropertysymbols -- safe
  var f$4 = Object.getOwnPropertySymbols;

  var objectGetOwnPropertySymbols = {
  	f: f$4
  };

  var concat = functionUncurryThis([].concat);

  // all object keys, includes non-enumerable and symbols
  var ownKeys$1 = getBuiltIn('Reflect', 'ownKeys') || function ownKeys(it) {
    var keys = objectGetOwnPropertyNames.f(anObject(it));
    var getOwnPropertySymbols = objectGetOwnPropertySymbols.f;
    return getOwnPropertySymbols ? concat(keys, getOwnPropertySymbols(it)) : keys;
  };

  var copyConstructorProperties = function (target, source) {
    var keys = ownKeys$1(source);
    var defineProperty = objectDefineProperty.f;
    var getOwnPropertyDescriptor = objectGetOwnPropertyDescriptor.f;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!hasOwnProperty_1(target, key)) defineProperty(target, key, getOwnPropertyDescriptor(source, key));
    }
  };

  var replacement = /#|\.prototype\./;

  var isForced = function (feature, detection) {
    var value = data[normalize(feature)];
    return value == POLYFILL ? true
      : value == NATIVE ? false
      : isCallable(detection) ? fails(detection)
      : !!detection;
  };

  var normalize = isForced.normalize = function (string) {
    return String(string).replace(replacement, '.').toLowerCase();
  };

  var data = isForced.data = {};
  var NATIVE = isForced.NATIVE = 'N';
  var POLYFILL = isForced.POLYFILL = 'P';

  var isForced_1 = isForced;

  var getOwnPropertyDescriptor$1 = objectGetOwnPropertyDescriptor.f;






  /*
    options.target      - name of the target object
    options.global      - target is the global object
    options.stat        - export as static methods of target
    options.proto       - export as prototype methods of target
    options.real        - real prototype method for the `pure` version
    options.forced      - export even if the native feature is available
    options.bind        - bind methods to the target, required for the `pure` version
    options.wrap        - wrap constructors to preventing global pollution, required for the `pure` version
    options.unsafe      - use the simple assignment of property instead of delete + defineProperty
    options.sham        - add a flag to not completely full polyfills
    options.enumerable  - export as enumerable property
    options.noTargetGet - prevent calling a getter on target
    options.name        - the .name of the function if it does not match the key
  */
  var _export = function (options, source) {
    var TARGET = options.target;
    var GLOBAL = options.global;
    var STATIC = options.stat;
    var FORCED, target, key, targetProperty, sourceProperty, descriptor;
    if (GLOBAL) {
      target = global_1;
    } else if (STATIC) {
      target = global_1[TARGET] || setGlobal(TARGET, {});
    } else {
      target = (global_1[TARGET] || {}).prototype;
    }
    if (target) for (key in source) {
      sourceProperty = source[key];
      if (options.noTargetGet) {
        descriptor = getOwnPropertyDescriptor$1(target, key);
        targetProperty = descriptor && descriptor.value;
      } else targetProperty = target[key];
      FORCED = isForced_1(GLOBAL ? key : TARGET + (STATIC ? '.' : '#') + key, options.forced);
      // contained in target
      if (!FORCED && targetProperty !== undefined) {
        if (typeof sourceProperty == typeof targetProperty) continue;
        copyConstructorProperties(sourceProperty, targetProperty);
      }
      // add a flag to not completely full polyfills
      if (options.sham || (targetProperty && targetProperty.sham)) {
        createNonEnumerableProperty(sourceProperty, 'sham', true);
      }
      // extend global
      redefine(target, key, sourceProperty, options);
    }
  };

  var bind$2 = functionUncurryThis(functionUncurryThis.bind);

  // optional / simple context binding
  var functionBindContext = function (fn, that) {
    aCallable(fn);
    return that === undefined ? fn : bind$2 ? bind$2(fn, that) : function (/* ...args */) {
      return fn.apply(that, arguments);
    };
  };

  // `IsArray` abstract operation
  // https://tc39.es/ecma262/#sec-isarray
  // eslint-disable-next-line es/no-array-isarray -- safe
  var isArray = Array.isArray || function isArray(argument) {
    return classofRaw(argument) == 'Array';
  };

  var TO_STRING_TAG = wellKnownSymbol('toStringTag');
  var test = {};

  test[TO_STRING_TAG] = 'z';

  var toStringTagSupport = String(test) === '[object z]';

  var TO_STRING_TAG$1 = wellKnownSymbol('toStringTag');
  var Object$4 = global_1.Object;

  // ES3 wrong here
  var CORRECT_ARGUMENTS = classofRaw(function () { return arguments; }()) == 'Arguments';

  // fallback for IE11 Script Access Denied error
  var tryGet = function (it, key) {
    try {
      return it[key];
    } catch (error) { /* empty */ }
  };

  // getting tag from ES6+ `Object.prototype.toString`
  var classof = toStringTagSupport ? classofRaw : function (it) {
    var O, tag, result;
    return it === undefined ? 'Undefined' : it === null ? 'Null'
      // @@toStringTag case
      : typeof (tag = tryGet(O = Object$4(it), TO_STRING_TAG$1)) == 'string' ? tag
      // builtinTag case
      : CORRECT_ARGUMENTS ? classofRaw(O)
      // ES3 arguments fallback
      : (result = classofRaw(O)) == 'Object' && isCallable(O.callee) ? 'Arguments' : result;
  };

  var noop = function () { /* empty */ };
  var empty = [];
  var construct = getBuiltIn('Reflect', 'construct');
  var constructorRegExp = /^\s*(?:class|function)\b/;
  var exec = functionUncurryThis(constructorRegExp.exec);
  var INCORRECT_TO_STRING = !constructorRegExp.exec(noop);

  var isConstructorModern = function (argument) {
    if (!isCallable(argument)) return false;
    try {
      construct(noop, empty, argument);
      return true;
    } catch (error) {
      return false;
    }
  };

  var isConstructorLegacy = function (argument) {
    if (!isCallable(argument)) return false;
    switch (classof(argument)) {
      case 'AsyncFunction':
      case 'GeneratorFunction':
      case 'AsyncGeneratorFunction': return false;
      // we can't check .prototype since constructors produced by .bind haven't it
    } return INCORRECT_TO_STRING || !!exec(constructorRegExp, inspectSource(argument));
  };

  // `IsConstructor` abstract operation
  // https://tc39.es/ecma262/#sec-isconstructor
  var isConstructor = !construct || fails(function () {
    var called;
    return isConstructorModern(isConstructorModern.call)
      || !isConstructorModern(Object)
      || !isConstructorModern(function () { called = true; })
      || called;
  }) ? isConstructorLegacy : isConstructorModern;

  var SPECIES = wellKnownSymbol('species');
  var Array$1 = global_1.Array;

  // a part of `ArraySpeciesCreate` abstract operation
  // https://tc39.es/ecma262/#sec-arrayspeciescreate
  var arraySpeciesConstructor = function (originalArray) {
    var C;
    if (isArray(originalArray)) {
      C = originalArray.constructor;
      // cross-realm fallback
      if (isConstructor(C) && (C === Array$1 || isArray(C.prototype))) C = undefined;
      else if (isObject(C)) {
        C = C[SPECIES];
        if (C === null) C = undefined;
      }
    } return C === undefined ? Array$1 : C;
  };

  // `ArraySpeciesCreate` abstract operation
  // https://tc39.es/ecma262/#sec-arrayspeciescreate
  var arraySpeciesCreate = function (originalArray, length) {
    return new (arraySpeciesConstructor(originalArray))(length === 0 ? 0 : length);
  };

  var push$1 = functionUncurryThis([].push);

  // `Array.prototype.{ forEach, map, filter, some, every, find, findIndex, filterReject }` methods implementation
  var createMethod$1 = function (TYPE) {
    var IS_MAP = TYPE == 1;
    var IS_FILTER = TYPE == 2;
    var IS_SOME = TYPE == 3;
    var IS_EVERY = TYPE == 4;
    var IS_FIND_INDEX = TYPE == 6;
    var IS_FILTER_REJECT = TYPE == 7;
    var NO_HOLES = TYPE == 5 || IS_FIND_INDEX;
    return function ($this, callbackfn, that, specificCreate) {
      var O = toObject$1($this);
      var self = indexedObject(O);
      var boundFunction = functionBindContext(callbackfn, that);
      var length = lengthOfArrayLike(self);
      var index = 0;
      var create = specificCreate || arraySpeciesCreate;
      var target = IS_MAP ? create($this, length) : IS_FILTER || IS_FILTER_REJECT ? create($this, 0) : undefined;
      var value, result;
      for (;length > index; index++) if (NO_HOLES || index in self) {
        value = self[index];
        result = boundFunction(value, index, O);
        if (TYPE) {
          if (IS_MAP) target[index] = result; // map
          else if (result) switch (TYPE) {
            case 3: return true;              // some
            case 5: return value;             // find
            case 6: return index;             // findIndex
            case 2: push$1(target, value);      // filter
          } else switch (TYPE) {
            case 4: return false;             // every
            case 7: push$1(target, value);      // filterReject
          }
        }
      }
      return IS_FIND_INDEX ? -1 : IS_SOME || IS_EVERY ? IS_EVERY : target;
    };
  };

  var arrayIteration = {
    // `Array.prototype.forEach` method
    // https://tc39.es/ecma262/#sec-array.prototype.foreach
    forEach: createMethod$1(0),
    // `Array.prototype.map` method
    // https://tc39.es/ecma262/#sec-array.prototype.map
    map: createMethod$1(1),
    // `Array.prototype.filter` method
    // https://tc39.es/ecma262/#sec-array.prototype.filter
    filter: createMethod$1(2),
    // `Array.prototype.some` method
    // https://tc39.es/ecma262/#sec-array.prototype.some
    some: createMethod$1(3),
    // `Array.prototype.every` method
    // https://tc39.es/ecma262/#sec-array.prototype.every
    every: createMethod$1(4),
    // `Array.prototype.find` method
    // https://tc39.es/ecma262/#sec-array.prototype.find
    find: createMethod$1(5),
    // `Array.prototype.findIndex` method
    // https://tc39.es/ecma262/#sec-array.prototype.findIndex
    findIndex: createMethod$1(6),
    // `Array.prototype.filterReject` method
    // https://github.com/tc39/proposal-array-filtering
    filterReject: createMethod$1(7)
  };

  var arrayMethodIsStrict = function (METHOD_NAME, argument) {
    var method = [][METHOD_NAME];
    return !!method && fails(function () {
      // eslint-disable-next-line no-useless-call,no-throw-literal -- required for testing
      method.call(null, argument || function () { throw 1; }, 1);
    });
  };

  var $forEach = arrayIteration.forEach;


  var STRICT_METHOD = arrayMethodIsStrict('forEach');

  // `Array.prototype.forEach` method implementation
  // https://tc39.es/ecma262/#sec-array.prototype.foreach
  var arrayForEach = !STRICT_METHOD ? function forEach(callbackfn /* , thisArg */) {
    return $forEach(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  // eslint-disable-next-line es/no-array-prototype-foreach -- safe
  } : [].forEach;

  // `Array.prototype.forEach` method
  // https://tc39.es/ecma262/#sec-array.prototype.foreach
  // eslint-disable-next-line es/no-array-prototype-foreach -- safe
  _export({ target: 'Array', proto: true, forced: [].forEach != arrayForEach }, {
    forEach: arrayForEach
  });

  // iterable DOM collections
  // flag - `iterable` interface - 'entries', 'keys', 'values', 'forEach' methods
  var domIterables = {
    CSSRuleList: 0,
    CSSStyleDeclaration: 0,
    CSSValueList: 0,
    ClientRectList: 0,
    DOMRectList: 0,
    DOMStringList: 0,
    DOMTokenList: 1,
    DataTransferItemList: 0,
    FileList: 0,
    HTMLAllCollection: 0,
    HTMLCollection: 0,
    HTMLFormElement: 0,
    HTMLSelectElement: 0,
    MediaList: 0,
    MimeTypeArray: 0,
    NamedNodeMap: 0,
    NodeList: 1,
    PaintRequestList: 0,
    Plugin: 0,
    PluginArray: 0,
    SVGLengthList: 0,
    SVGNumberList: 0,
    SVGPathSegList: 0,
    SVGPointList: 0,
    SVGStringList: 0,
    SVGTransformList: 0,
    SourceBufferList: 0,
    StyleSheetList: 0,
    TextTrackCueList: 0,
    TextTrackList: 0,
    TouchList: 0
  };

  // in old WebKit versions, `element.classList` is not an instance of global `DOMTokenList`


  var classList = documentCreateElement('span').classList;
  var DOMTokenListPrototype = classList && classList.constructor && classList.constructor.prototype;

  var domTokenListPrototype = DOMTokenListPrototype === Object.prototype ? undefined : DOMTokenListPrototype;

  var handlePrototype = function (CollectionPrototype) {
    // some Chrome versions have non-configurable methods on DOMTokenList
    if (CollectionPrototype && CollectionPrototype.forEach !== arrayForEach) try {
      createNonEnumerableProperty(CollectionPrototype, 'forEach', arrayForEach);
    } catch (error) {
      CollectionPrototype.forEach = arrayForEach;
    }
  };

  for (var COLLECTION_NAME in domIterables) {
    if (domIterables[COLLECTION_NAME]) {
      handlePrototype(global_1[COLLECTION_NAME] && global_1[COLLECTION_NAME].prototype);
    }
  }

  handlePrototype(domTokenListPrototype);

  var canUseDOM = !!(
    typeof window !== 'undefined' &&
    window.document &&
    window.document.createElement
  );

  var canUseDom = canUseDOM;

  var SPECIES$1 = wellKnownSymbol('species');

  var arrayMethodHasSpeciesSupport = function (METHOD_NAME) {
    // We can't use this feature detection in V8 since it causes
    // deoptimization and serious performance degradation
    // https://github.com/zloirock/core-js/issues/677
    return engineV8Version >= 51 || !fails(function () {
      var array = [];
      var constructor = array.constructor = {};
      constructor[SPECIES$1] = function () {
        return { foo: 1 };
      };
      return array[METHOD_NAME](Boolean).foo !== 1;
    });
  };

  var $filter = arrayIteration.filter;


  var HAS_SPECIES_SUPPORT = arrayMethodHasSpeciesSupport('filter');

  // `Array.prototype.filter` method
  // https://tc39.es/ecma262/#sec-array.prototype.filter
  // with adding support of @@species
  _export({ target: 'Array', proto: true, forced: !HAS_SPECIES_SUPPORT }, {
    filter: function filter(callbackfn /* , thisArg */) {
      return $filter(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
    }
  });

  // `Object.keys` method
  // https://tc39.es/ecma262/#sec-object.keys
  // eslint-disable-next-line es/no-object-keys -- safe
  var objectKeys = Object.keys || function keys(O) {
    return objectKeysInternal(O, enumBugKeys);
  };

  // `Object.defineProperties` method
  // https://tc39.es/ecma262/#sec-object.defineproperties
  // eslint-disable-next-line es/no-object-defineproperties -- safe
  var objectDefineProperties = descriptors ? Object.defineProperties : function defineProperties(O, Properties) {
    anObject(O);
    var props = toIndexedObject(Properties);
    var keys = objectKeys(Properties);
    var length = keys.length;
    var index = 0;
    var key;
    while (length > index) objectDefineProperty.f(O, key = keys[index++], props[key]);
    return O;
  };

  var html = getBuiltIn('document', 'documentElement');

  /* global ActiveXObject -- old IE, WSH */








  var GT = '>';
  var LT = '<';
  var PROTOTYPE = 'prototype';
  var SCRIPT = 'script';
  var IE_PROTO = sharedKey('IE_PROTO');

  var EmptyConstructor = function () { /* empty */ };

  var scriptTag = function (content) {
    return LT + SCRIPT + GT + content + LT + '/' + SCRIPT + GT;
  };

  // Create object with fake `null` prototype: use ActiveX Object with cleared prototype
  var NullProtoObjectViaActiveX = function (activeXDocument) {
    activeXDocument.write(scriptTag(''));
    activeXDocument.close();
    var temp = activeXDocument.parentWindow.Object;
    activeXDocument = null; // avoid memory leak
    return temp;
  };

  // Create object with fake `null` prototype: use iframe Object with cleared prototype
  var NullProtoObjectViaIFrame = function () {
    // Thrash, waste and sodomy: IE GC bug
    var iframe = documentCreateElement('iframe');
    var JS = 'java' + SCRIPT + ':';
    var iframeDocument;
    iframe.style.display = 'none';
    html.appendChild(iframe);
    // https://github.com/zloirock/core-js/issues/475
    iframe.src = String(JS);
    iframeDocument = iframe.contentWindow.document;
    iframeDocument.open();
    iframeDocument.write(scriptTag('document.F=Object'));
    iframeDocument.close();
    return iframeDocument.F;
  };

  // Check for document.domain and active x support
  // No need to use active x approach when document.domain is not set
  // see https://github.com/es-shims/es5-shim/issues/150
  // variation of https://github.com/kitcambridge/es5-shim/commit/4f738ac066346
  // avoid IE GC bug
  var activeXDocument;
  var NullProtoObject = function () {
    try {
      activeXDocument = new ActiveXObject('htmlfile');
    } catch (error) { /* ignore */ }
    NullProtoObject = typeof document != 'undefined'
      ? document.domain && activeXDocument
        ? NullProtoObjectViaActiveX(activeXDocument) // old IE
        : NullProtoObjectViaIFrame()
      : NullProtoObjectViaActiveX(activeXDocument); // WSH
    var length = enumBugKeys.length;
    while (length--) delete NullProtoObject[PROTOTYPE][enumBugKeys[length]];
    return NullProtoObject();
  };

  hiddenKeys[IE_PROTO] = true;

  // `Object.create` method
  // https://tc39.es/ecma262/#sec-object.create
  var objectCreate = Object.create || function create(O, Properties) {
    var result;
    if (O !== null) {
      EmptyConstructor[PROTOTYPE] = anObject(O);
      result = new EmptyConstructor();
      EmptyConstructor[PROTOTYPE] = null;
      // add "__proto__" for Object.getPrototypeOf polyfill
      result[IE_PROTO] = O;
    } else result = NullProtoObject();
    return Properties === undefined ? result : objectDefineProperties(result, Properties);
  };

  var UNSCOPABLES = wellKnownSymbol('unscopables');
  var ArrayPrototype = Array.prototype;

  // Array.prototype[@@unscopables]
  // https://tc39.es/ecma262/#sec-array.prototype-@@unscopables
  if (ArrayPrototype[UNSCOPABLES] == undefined) {
    objectDefineProperty.f(ArrayPrototype, UNSCOPABLES, {
      configurable: true,
      value: objectCreate(null)
    });
  }

  // add a key to Array.prototype[@@unscopables]
  var addToUnscopables = function (key) {
    ArrayPrototype[UNSCOPABLES][key] = true;
  };

  var iterators = {};

  var correctPrototypeGetter = !fails(function () {
    function F() { /* empty */ }
    F.prototype.constructor = null;
    // eslint-disable-next-line es/no-object-getprototypeof -- required for testing
    return Object.getPrototypeOf(new F()) !== F.prototype;
  });

  var IE_PROTO$1 = sharedKey('IE_PROTO');
  var Object$5 = global_1.Object;
  var ObjectPrototype = Object$5.prototype;

  // `Object.getPrototypeOf` method
  // https://tc39.es/ecma262/#sec-object.getprototypeof
  var objectGetPrototypeOf = correctPrototypeGetter ? Object$5.getPrototypeOf : function (O) {
    var object = toObject$1(O);
    if (hasOwnProperty_1(object, IE_PROTO$1)) return object[IE_PROTO$1];
    var constructor = object.constructor;
    if (isCallable(constructor) && object instanceof constructor) {
      return constructor.prototype;
    } return object instanceof Object$5 ? ObjectPrototype : null;
  };

  var ITERATOR = wellKnownSymbol('iterator');
  var BUGGY_SAFARI_ITERATORS = false;

  // `%IteratorPrototype%` object
  // https://tc39.es/ecma262/#sec-%iteratorprototype%-object
  var IteratorPrototype, PrototypeOfArrayIteratorPrototype, arrayIterator;

  /* eslint-disable es/no-array-prototype-keys -- safe */
  if ([].keys) {
    arrayIterator = [].keys();
    // Safari 8 has buggy iterators w/o `next`
    if (!('next' in arrayIterator)) BUGGY_SAFARI_ITERATORS = true;
    else {
      PrototypeOfArrayIteratorPrototype = objectGetPrototypeOf(objectGetPrototypeOf(arrayIterator));
      if (PrototypeOfArrayIteratorPrototype !== Object.prototype) IteratorPrototype = PrototypeOfArrayIteratorPrototype;
    }
  }

  var NEW_ITERATOR_PROTOTYPE = IteratorPrototype == undefined || fails(function () {
    var test = {};
    // FF44- legacy iterators case
    return IteratorPrototype[ITERATOR].call(test) !== test;
  });

  if (NEW_ITERATOR_PROTOTYPE) IteratorPrototype = {};

  // `%IteratorPrototype%[@@iterator]()` method
  // https://tc39.es/ecma262/#sec-%iteratorprototype%-@@iterator
  if (!isCallable(IteratorPrototype[ITERATOR])) {
    redefine(IteratorPrototype, ITERATOR, function () {
      return this;
    });
  }

  var iteratorsCore = {
    IteratorPrototype: IteratorPrototype,
    BUGGY_SAFARI_ITERATORS: BUGGY_SAFARI_ITERATORS
  };

  var defineProperty$1 = objectDefineProperty.f;



  var TO_STRING_TAG$2 = wellKnownSymbol('toStringTag');

  var setToStringTag = function (it, TAG, STATIC) {
    if (it && !hasOwnProperty_1(it = STATIC ? it : it.prototype, TO_STRING_TAG$2)) {
      defineProperty$1(it, TO_STRING_TAG$2, { configurable: true, value: TAG });
    }
  };

  var IteratorPrototype$1 = iteratorsCore.IteratorPrototype;





  var returnThis = function () { return this; };

  var createIteratorConstructor = function (IteratorConstructor, NAME, next, ENUMERABLE_NEXT) {
    var TO_STRING_TAG = NAME + ' Iterator';
    IteratorConstructor.prototype = objectCreate(IteratorPrototype$1, { next: createPropertyDescriptor(+!ENUMERABLE_NEXT, next) });
    setToStringTag(IteratorConstructor, TO_STRING_TAG, false);
    iterators[TO_STRING_TAG] = returnThis;
    return IteratorConstructor;
  };

  var String$3 = global_1.String;
  var TypeError$8 = global_1.TypeError;

  var aPossiblePrototype = function (argument) {
    if (typeof argument == 'object' || isCallable(argument)) return argument;
    throw TypeError$8("Can't set " + String$3(argument) + ' as a prototype');
  };

  /* eslint-disable no-proto -- safe */




  // `Object.setPrototypeOf` method
  // https://tc39.es/ecma262/#sec-object.setprototypeof
  // Works with __proto__ only. Old v8 can't work with null proto objects.
  // eslint-disable-next-line es/no-object-setprototypeof -- safe
  var objectSetPrototypeOf = Object.setPrototypeOf || ('__proto__' in {} ? function () {
    var CORRECT_SETTER = false;
    var test = {};
    var setter;
    try {
      // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
      setter = functionUncurryThis(Object.getOwnPropertyDescriptor(Object.prototype, '__proto__').set);
      setter(test, []);
      CORRECT_SETTER = test instanceof Array;
    } catch (error) { /* empty */ }
    return function setPrototypeOf(O, proto) {
      anObject(O);
      aPossiblePrototype(proto);
      if (CORRECT_SETTER) setter(O, proto);
      else O.__proto__ = proto;
      return O;
    };
  }() : undefined);

  var PROPER_FUNCTION_NAME = functionName.PROPER;
  var CONFIGURABLE_FUNCTION_NAME = functionName.CONFIGURABLE;
  var IteratorPrototype$2 = iteratorsCore.IteratorPrototype;
  var BUGGY_SAFARI_ITERATORS$1 = iteratorsCore.BUGGY_SAFARI_ITERATORS;
  var ITERATOR$1 = wellKnownSymbol('iterator');
  var KEYS = 'keys';
  var VALUES = 'values';
  var ENTRIES = 'entries';

  var returnThis$1 = function () { return this; };

  var defineIterator = function (Iterable, NAME, IteratorConstructor, next, DEFAULT, IS_SET, FORCED) {
    createIteratorConstructor(IteratorConstructor, NAME, next);

    var getIterationMethod = function (KIND) {
      if (KIND === DEFAULT && defaultIterator) return defaultIterator;
      if (!BUGGY_SAFARI_ITERATORS$1 && KIND in IterablePrototype) return IterablePrototype[KIND];
      switch (KIND) {
        case KEYS: return function keys() { return new IteratorConstructor(this, KIND); };
        case VALUES: return function values() { return new IteratorConstructor(this, KIND); };
        case ENTRIES: return function entries() { return new IteratorConstructor(this, KIND); };
      } return function () { return new IteratorConstructor(this); };
    };

    var TO_STRING_TAG = NAME + ' Iterator';
    var INCORRECT_VALUES_NAME = false;
    var IterablePrototype = Iterable.prototype;
    var nativeIterator = IterablePrototype[ITERATOR$1]
      || IterablePrototype['@@iterator']
      || DEFAULT && IterablePrototype[DEFAULT];
    var defaultIterator = !BUGGY_SAFARI_ITERATORS$1 && nativeIterator || getIterationMethod(DEFAULT);
    var anyNativeIterator = NAME == 'Array' ? IterablePrototype.entries || nativeIterator : nativeIterator;
    var CurrentIteratorPrototype, methods, KEY;

    // fix native
    if (anyNativeIterator) {
      CurrentIteratorPrototype = objectGetPrototypeOf(anyNativeIterator.call(new Iterable()));
      if (CurrentIteratorPrototype !== Object.prototype && CurrentIteratorPrototype.next) {
        if ( objectGetPrototypeOf(CurrentIteratorPrototype) !== IteratorPrototype$2) {
          if (objectSetPrototypeOf) {
            objectSetPrototypeOf(CurrentIteratorPrototype, IteratorPrototype$2);
          } else if (!isCallable(CurrentIteratorPrototype[ITERATOR$1])) {
            redefine(CurrentIteratorPrototype, ITERATOR$1, returnThis$1);
          }
        }
        // Set @@toStringTag to native iterators
        setToStringTag(CurrentIteratorPrototype, TO_STRING_TAG, true);
      }
    }

    // fix Array.prototype.{ values, @@iterator }.name in V8 / FF
    if (PROPER_FUNCTION_NAME && DEFAULT == VALUES && nativeIterator && nativeIterator.name !== VALUES) {
      if ( CONFIGURABLE_FUNCTION_NAME) {
        createNonEnumerableProperty(IterablePrototype, 'name', VALUES);
      } else {
        INCORRECT_VALUES_NAME = true;
        defaultIterator = function values() { return functionCall(nativeIterator, this); };
      }
    }

    // export additional methods
    if (DEFAULT) {
      methods = {
        values: getIterationMethod(VALUES),
        keys: IS_SET ? defaultIterator : getIterationMethod(KEYS),
        entries: getIterationMethod(ENTRIES)
      };
      if (FORCED) for (KEY in methods) {
        if (BUGGY_SAFARI_ITERATORS$1 || INCORRECT_VALUES_NAME || !(KEY in IterablePrototype)) {
          redefine(IterablePrototype, KEY, methods[KEY]);
        }
      } else _export({ target: NAME, proto: true, forced: BUGGY_SAFARI_ITERATORS$1 || INCORRECT_VALUES_NAME }, methods);
    }

    // define iterator
    if ( IterablePrototype[ITERATOR$1] !== defaultIterator) {
      redefine(IterablePrototype, ITERATOR$1, defaultIterator, { name: DEFAULT });
    }
    iterators[NAME] = defaultIterator;

    return methods;
  };

  var ARRAY_ITERATOR = 'Array Iterator';
  var setInternalState = internalState.set;
  var getInternalState = internalState.getterFor(ARRAY_ITERATOR);

  // `Array.prototype.entries` method
  // https://tc39.es/ecma262/#sec-array.prototype.entries
  // `Array.prototype.keys` method
  // https://tc39.es/ecma262/#sec-array.prototype.keys
  // `Array.prototype.values` method
  // https://tc39.es/ecma262/#sec-array.prototype.values
  // `Array.prototype[@@iterator]` method
  // https://tc39.es/ecma262/#sec-array.prototype-@@iterator
  // `CreateArrayIterator` internal method
  // https://tc39.es/ecma262/#sec-createarrayiterator
  var es_array_iterator = defineIterator(Array, 'Array', function (iterated, kind) {
    setInternalState(this, {
      type: ARRAY_ITERATOR,
      target: toIndexedObject(iterated), // target
      index: 0,                          // next index
      kind: kind                         // kind
    });
  // `%ArrayIteratorPrototype%.next` method
  // https://tc39.es/ecma262/#sec-%arrayiteratorprototype%.next
  }, function () {
    var state = getInternalState(this);
    var target = state.target;
    var kind = state.kind;
    var index = state.index++;
    if (!target || index >= target.length) {
      state.target = undefined;
      return { value: undefined, done: true };
    }
    if (kind == 'keys') return { value: index, done: false };
    if (kind == 'values') return { value: target[index], done: false };
    return { value: [index, target[index]], done: false };
  }, 'values');

  // argumentsList[@@iterator] is %ArrayProto_values%
  // https://tc39.es/ecma262/#sec-createunmappedargumentsobject
  // https://tc39.es/ecma262/#sec-createmappedargumentsobject
  iterators.Arguments = iterators.Array;

  // https://tc39.es/ecma262/#sec-array.prototype-@@unscopables
  addToUnscopables('keys');
  addToUnscopables('values');
  addToUnscopables('entries');

  // eslint-disable-next-line es/no-object-assign -- safe
  var $assign = Object.assign;
  // eslint-disable-next-line es/no-object-defineproperty -- required for testing
  var defineProperty$2 = Object.defineProperty;
  var concat$1 = functionUncurryThis([].concat);

  // `Object.assign` method
  // https://tc39.es/ecma262/#sec-object.assign
  var objectAssign$1 = !$assign || fails(function () {
    // should have correct order of operations (Edge bug)
    if (descriptors && $assign({ b: 1 }, $assign(defineProperty$2({}, 'a', {
      enumerable: true,
      get: function () {
        defineProperty$2(this, 'b', {
          value: 3,
          enumerable: false
        });
      }
    }), { b: 2 })).b !== 1) return true;
    // should work with symbols and should have deterministic property order (V8 bug)
    var A = {};
    var B = {};
    // eslint-disable-next-line es/no-symbol -- safe
    var symbol = Symbol();
    var alphabet = 'abcdefghijklmnopqrst';
    A[symbol] = 7;
    alphabet.split('').forEach(function (chr) { B[chr] = chr; });
    return $assign({}, A)[symbol] != 7 || objectKeys($assign({}, B)).join('') != alphabet;
  }) ? function assign(target, source) { // eslint-disable-line no-unused-vars -- required for `.length`
    var T = toObject$1(target);
    var argumentsLength = arguments.length;
    var index = 1;
    var getOwnPropertySymbols = objectGetOwnPropertySymbols.f;
    var propertyIsEnumerable = objectPropertyIsEnumerable.f;
    while (argumentsLength > index) {
      var S = indexedObject(arguments[index++]);
      var keys = getOwnPropertySymbols ? concat$1(objectKeys(S), getOwnPropertySymbols(S)) : objectKeys(S);
      var length = keys.length;
      var j = 0;
      var key;
      while (length > j) {
        key = keys[j++];
        if (!descriptors || functionCall(propertyIsEnumerable, S, key)) T[key] = S[key];
      }
    } return T;
  } : $assign;

  // `Object.assign` method
  // https://tc39.es/ecma262/#sec-object.assign
  // eslint-disable-next-line es/no-object-assign -- required for testing
  _export({ target: 'Object', stat: true, forced: Object.assign !== objectAssign$1 }, {
    assign: objectAssign$1
  });

  // `Object.prototype.toString` method implementation
  // https://tc39.es/ecma262/#sec-object.prototype.tostring
  var objectToString = toStringTagSupport ? {}.toString : function toString() {
    return '[object ' + classof(this) + ']';
  };

  // `Object.prototype.toString` method
  // https://tc39.es/ecma262/#sec-object.prototype.tostring
  if (!toStringTagSupport) {
    redefine(Object.prototype, 'toString', objectToString, { unsafe: true });
  }

  var String$4 = global_1.String;

  var toString_1 = function (argument) {
    if (classof(argument) === 'Symbol') throw TypeError('Cannot convert a Symbol value to a string');
    return String$4(argument);
  };

  // a string of all valid unicode whitespaces
  var whitespaces = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002' +
    '\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

  var replace = functionUncurryThis(''.replace);
  var whitespace = '[' + whitespaces + ']';
  var ltrim = RegExp('^' + whitespace + whitespace + '*');
  var rtrim = RegExp(whitespace + whitespace + '*$');

  // `String.prototype.{ trim, trimStart, trimEnd, trimLeft, trimRight }` methods implementation
  var createMethod$2 = function (TYPE) {
    return function ($this) {
      var string = toString_1(requireObjectCoercible($this));
      if (TYPE & 1) string = replace(string, ltrim, '');
      if (TYPE & 2) string = replace(string, rtrim, '');
      return string;
    };
  };

  var stringTrim = {
    // `String.prototype.{ trimLeft, trimStart }` methods
    // https://tc39.es/ecma262/#sec-string.prototype.trimstart
    start: createMethod$2(1),
    // `String.prototype.{ trimRight, trimEnd }` methods
    // https://tc39.es/ecma262/#sec-string.prototype.trimend
    end: createMethod$2(2),
    // `String.prototype.trim` method
    // https://tc39.es/ecma262/#sec-string.prototype.trim
    trim: createMethod$2(3)
  };

  var trim = stringTrim.trim;


  var $parseInt = global_1.parseInt;
  var Symbol$2 = global_1.Symbol;
  var ITERATOR$2 = Symbol$2 && Symbol$2.iterator;
  var hex = /^[+-]?0x/i;
  var exec$1 = functionUncurryThis(hex.exec);
  var FORCED = $parseInt(whitespaces + '08') !== 8 || $parseInt(whitespaces + '0x16') !== 22
    // MS Edge 18- broken with boxed symbols
    || (ITERATOR$2 && !fails(function () { $parseInt(Object(ITERATOR$2)); }));

  // `parseInt` method
  // https://tc39.es/ecma262/#sec-parseint-string-radix
  var numberParseInt = FORCED ? function parseInt(string, radix) {
    var S = trim(toString_1(string));
    return $parseInt(S, (radix >>> 0) || (exec$1(hex, S) ? 16 : 10));
  } : $parseInt;

  // `parseInt` method
  // https://tc39.es/ecma262/#sec-parseint-string-radix
  _export({ global: true, forced: parseInt != numberParseInt }, {
    parseInt: numberParseInt
  });

  var charAt = functionUncurryThis(''.charAt);
  var charCodeAt = functionUncurryThis(''.charCodeAt);
  var stringSlice$1 = functionUncurryThis(''.slice);

  var createMethod$3 = function (CONVERT_TO_STRING) {
    return function ($this, pos) {
      var S = toString_1(requireObjectCoercible($this));
      var position = toIntegerOrInfinity(pos);
      var size = S.length;
      var first, second;
      if (position < 0 || position >= size) return CONVERT_TO_STRING ? '' : undefined;
      first = charCodeAt(S, position);
      return first < 0xD800 || first > 0xDBFF || position + 1 === size
        || (second = charCodeAt(S, position + 1)) < 0xDC00 || second > 0xDFFF
          ? CONVERT_TO_STRING
            ? charAt(S, position)
            : first
          : CONVERT_TO_STRING
            ? stringSlice$1(S, position, position + 2)
            : (first - 0xD800 << 10) + (second - 0xDC00) + 0x10000;
    };
  };

  var stringMultibyte = {
    // `String.prototype.codePointAt` method
    // https://tc39.es/ecma262/#sec-string.prototype.codepointat
    codeAt: createMethod$3(false),
    // `String.prototype.at` method
    // https://github.com/mathiasbynens/String.prototype.at
    charAt: createMethod$3(true)
  };

  var charAt$1 = stringMultibyte.charAt;




  var STRING_ITERATOR = 'String Iterator';
  var setInternalState$1 = internalState.set;
  var getInternalState$1 = internalState.getterFor(STRING_ITERATOR);

  // `String.prototype[@@iterator]` method
  // https://tc39.es/ecma262/#sec-string.prototype-@@iterator
  defineIterator(String, 'String', function (iterated) {
    setInternalState$1(this, {
      type: STRING_ITERATOR,
      string: toString_1(iterated),
      index: 0
    });
  // `%StringIteratorPrototype%.next` method
  // https://tc39.es/ecma262/#sec-%stringiteratorprototype%.next
  }, function next() {
    var state = getInternalState$1(this);
    var string = state.string;
    var index = state.index;
    var point;
    if (index >= string.length) return { value: undefined, done: true };
    point = charAt$1(string, index);
    state.index += point.length;
    return { value: point, done: false };
  });

  var redefineAll = function (target, src, options) {
    for (var key in src) redefine(target, key, src[key], options);
    return target;
  };

  var createProperty = function (object, key, value) {
    var propertyKey = toPropertyKey(key);
    if (propertyKey in object) objectDefineProperty.f(object, propertyKey, createPropertyDescriptor(0, value));
    else object[propertyKey] = value;
  };

  var Array$2 = global_1.Array;
  var max$1 = Math.max;

  var arraySliceSimple = function (O, start, end) {
    var length = lengthOfArrayLike(O);
    var k = toAbsoluteIndex(start, length);
    var fin = toAbsoluteIndex(end === undefined ? length : end, length);
    var result = Array$2(max$1(fin - k, 0));
    for (var n = 0; k < fin; k++, n++) createProperty(result, n, O[k]);
    result.length = n;
    return result;
  };

  /* eslint-disable es/no-object-getownpropertynames -- safe */


  var $getOwnPropertyNames = objectGetOwnPropertyNames.f;


  var windowNames = typeof window == 'object' && window && Object.getOwnPropertyNames
    ? Object.getOwnPropertyNames(window) : [];

  var getWindowNames = function (it) {
    try {
      return $getOwnPropertyNames(it);
    } catch (error) {
      return arraySliceSimple(windowNames);
    }
  };

  // fallback for IE11 buggy Object.getOwnPropertyNames with iframe and window
  var f$5 = function getOwnPropertyNames(it) {
    return windowNames && classofRaw(it) == 'Window'
      ? getWindowNames(it)
      : $getOwnPropertyNames(toIndexedObject(it));
  };

  var objectGetOwnPropertyNamesExternal = {
  	f: f$5
  };

  // FF26- bug: ArrayBuffers are non-extensible, but Object.isExtensible does not report it


  var arrayBufferNonExtensible = fails(function () {
    if (typeof ArrayBuffer == 'function') {
      var buffer = new ArrayBuffer(8);
      // eslint-disable-next-line es/no-object-isextensible, es/no-object-defineproperty -- safe
      if (Object.isExtensible(buffer)) Object.defineProperty(buffer, 'a', { value: 8 });
    }
  });

  // eslint-disable-next-line es/no-object-isextensible -- safe
  var $isExtensible = Object.isExtensible;
  var FAILS_ON_PRIMITIVES = fails(function () { $isExtensible(1); });

  // `Object.isExtensible` method
  // https://tc39.es/ecma262/#sec-object.isextensible
  var objectIsExtensible = (FAILS_ON_PRIMITIVES || arrayBufferNonExtensible) ? function isExtensible(it) {
    if (!isObject(it)) return false;
    if (arrayBufferNonExtensible && classofRaw(it) == 'ArrayBuffer') return false;
    return $isExtensible ? $isExtensible(it) : true;
  } : $isExtensible;

  var freezing = !fails(function () {
    // eslint-disable-next-line es/no-object-isextensible, es/no-object-preventextensions -- required for testing
    return Object.isExtensible(Object.preventExtensions({}));
  });

  var internalMetadata = createCommonjsModule$1(function (module) {
  var defineProperty = objectDefineProperty.f;






  var REQUIRED = false;
  var METADATA = uid('meta');
  var id = 0;

  var setMetadata = function (it) {
    defineProperty(it, METADATA, { value: {
      objectID: 'O' + id++, // object ID
      weakData: {}          // weak collections IDs
    } });
  };

  var fastKey = function (it, create) {
    // return a primitive with prefix
    if (!isObject(it)) return typeof it == 'symbol' ? it : (typeof it == 'string' ? 'S' : 'P') + it;
    if (!hasOwnProperty_1(it, METADATA)) {
      // can't set metadata to uncaught frozen object
      if (!objectIsExtensible(it)) return 'F';
      // not necessary to add metadata
      if (!create) return 'E';
      // add missing metadata
      setMetadata(it);
    // return object ID
    } return it[METADATA].objectID;
  };

  var getWeakData = function (it, create) {
    if (!hasOwnProperty_1(it, METADATA)) {
      // can't set metadata to uncaught frozen object
      if (!objectIsExtensible(it)) return true;
      // not necessary to add metadata
      if (!create) return false;
      // add missing metadata
      setMetadata(it);
    // return the store of weak collections IDs
    } return it[METADATA].weakData;
  };

  // add metadata on freeze-family methods calling
  var onFreeze = function (it) {
    if (freezing && REQUIRED && objectIsExtensible(it) && !hasOwnProperty_1(it, METADATA)) setMetadata(it);
    return it;
  };

  var enable = function () {
    meta.enable = function () { /* empty */ };
    REQUIRED = true;
    var getOwnPropertyNames = objectGetOwnPropertyNames.f;
    var splice = functionUncurryThis([].splice);
    var test = {};
    test[METADATA] = 1;

    // prevent exposing of metadata key
    if (getOwnPropertyNames(test).length) {
      objectGetOwnPropertyNames.f = function (it) {
        var result = getOwnPropertyNames(it);
        for (var i = 0, length = result.length; i < length; i++) {
          if (result[i] === METADATA) {
            splice(result, i, 1);
            break;
          }
        } return result;
      };

      _export({ target: 'Object', stat: true, forced: true }, {
        getOwnPropertyNames: objectGetOwnPropertyNamesExternal.f
      });
    }
  };

  var meta = module.exports = {
    enable: enable,
    fastKey: fastKey,
    getWeakData: getWeakData,
    onFreeze: onFreeze
  };

  hiddenKeys[METADATA] = true;
  });
  var internalMetadata_1 = internalMetadata.enable;
  var internalMetadata_2 = internalMetadata.fastKey;
  var internalMetadata_3 = internalMetadata.getWeakData;
  var internalMetadata_4 = internalMetadata.onFreeze;

  var ITERATOR$3 = wellKnownSymbol('iterator');
  var ArrayPrototype$1 = Array.prototype;

  // check on default Array iterator
  var isArrayIteratorMethod = function (it) {
    return it !== undefined && (iterators.Array === it || ArrayPrototype$1[ITERATOR$3] === it);
  };

  var ITERATOR$4 = wellKnownSymbol('iterator');

  var getIteratorMethod = function (it) {
    if (it != undefined) return getMethod(it, ITERATOR$4)
      || getMethod(it, '@@iterator')
      || iterators[classof(it)];
  };

  var TypeError$9 = global_1.TypeError;

  var getIterator = function (argument, usingIterator) {
    var iteratorMethod = arguments.length < 2 ? getIteratorMethod(argument) : usingIterator;
    if (aCallable(iteratorMethod)) return anObject(functionCall(iteratorMethod, argument));
    throw TypeError$9(tryToString(argument) + ' is not iterable');
  };

  var iteratorClose = function (iterator, kind, value) {
    var innerResult, innerError;
    anObject(iterator);
    try {
      innerResult = getMethod(iterator, 'return');
      if (!innerResult) {
        if (kind === 'throw') throw value;
        return value;
      }
      innerResult = functionCall(innerResult, iterator);
    } catch (error) {
      innerError = true;
      innerResult = error;
    }
    if (kind === 'throw') throw value;
    if (innerError) throw innerResult;
    anObject(innerResult);
    return value;
  };

  var TypeError$a = global_1.TypeError;

  var Result = function (stopped, result) {
    this.stopped = stopped;
    this.result = result;
  };

  var ResultPrototype = Result.prototype;

  var iterate = function (iterable, unboundFunction, options) {
    var that = options && options.that;
    var AS_ENTRIES = !!(options && options.AS_ENTRIES);
    var IS_ITERATOR = !!(options && options.IS_ITERATOR);
    var INTERRUPTED = !!(options && options.INTERRUPTED);
    var fn = functionBindContext(unboundFunction, that);
    var iterator, iterFn, index, length, result, next, step;

    var stop = function (condition) {
      if (iterator) iteratorClose(iterator, 'normal', condition);
      return new Result(true, condition);
    };

    var callFn = function (value) {
      if (AS_ENTRIES) {
        anObject(value);
        return INTERRUPTED ? fn(value[0], value[1], stop) : fn(value[0], value[1]);
      } return INTERRUPTED ? fn(value, stop) : fn(value);
    };

    if (IS_ITERATOR) {
      iterator = iterable;
    } else {
      iterFn = getIteratorMethod(iterable);
      if (!iterFn) throw TypeError$a(tryToString(iterable) + ' is not iterable');
      // optimisation for array iterators
      if (isArrayIteratorMethod(iterFn)) {
        for (index = 0, length = lengthOfArrayLike(iterable); length > index; index++) {
          result = callFn(iterable[index]);
          if (result && objectIsPrototypeOf(ResultPrototype, result)) return result;
        } return new Result(false);
      }
      iterator = getIterator(iterable, iterFn);
    }

    next = iterator.next;
    while (!(step = functionCall(next, iterator)).done) {
      try {
        result = callFn(step.value);
      } catch (error) {
        iteratorClose(iterator, 'throw', error);
      }
      if (typeof result == 'object' && result && objectIsPrototypeOf(ResultPrototype, result)) return result;
    } return new Result(false);
  };

  var TypeError$b = global_1.TypeError;

  var anInstance = function (it, Prototype) {
    if (objectIsPrototypeOf(Prototype, it)) return it;
    throw TypeError$b('Incorrect invocation');
  };

  var ITERATOR$5 = wellKnownSymbol('iterator');
  var SAFE_CLOSING = false;

  try {
    var called = 0;
    var iteratorWithReturn = {
      next: function () {
        return { done: !!called++ };
      },
      'return': function () {
        SAFE_CLOSING = true;
      }
    };
    iteratorWithReturn[ITERATOR$5] = function () {
      return this;
    };
    // eslint-disable-next-line es/no-array-from, no-throw-literal -- required for testing
    Array.from(iteratorWithReturn, function () { throw 2; });
  } catch (error) { /* empty */ }

  var checkCorrectnessOfIteration = function (exec, SKIP_CLOSING) {
    if (!SKIP_CLOSING && !SAFE_CLOSING) return false;
    var ITERATION_SUPPORT = false;
    try {
      var object = {};
      object[ITERATOR$5] = function () {
        return {
          next: function () {
            return { done: ITERATION_SUPPORT = true };
          }
        };
      };
      exec(object);
    } catch (error) { /* empty */ }
    return ITERATION_SUPPORT;
  };

  // makes subclassing work correct for wrapped built-ins
  var inheritIfRequired = function ($this, dummy, Wrapper) {
    var NewTarget, NewTargetPrototype;
    if (
      // it can work only with native `setPrototypeOf`
      objectSetPrototypeOf &&
      // we haven't completely correct pre-ES6 way for getting `new.target`, so use this
      isCallable(NewTarget = dummy.constructor) &&
      NewTarget !== Wrapper &&
      isObject(NewTargetPrototype = NewTarget.prototype) &&
      NewTargetPrototype !== Wrapper.prototype
    ) objectSetPrototypeOf($this, NewTargetPrototype);
    return $this;
  };

  var collection = function (CONSTRUCTOR_NAME, wrapper, common) {
    var IS_MAP = CONSTRUCTOR_NAME.indexOf('Map') !== -1;
    var IS_WEAK = CONSTRUCTOR_NAME.indexOf('Weak') !== -1;
    var ADDER = IS_MAP ? 'set' : 'add';
    var NativeConstructor = global_1[CONSTRUCTOR_NAME];
    var NativePrototype = NativeConstructor && NativeConstructor.prototype;
    var Constructor = NativeConstructor;
    var exported = {};

    var fixMethod = function (KEY) {
      var uncurriedNativeMethod = functionUncurryThis(NativePrototype[KEY]);
      redefine(NativePrototype, KEY,
        KEY == 'add' ? function add(value) {
          uncurriedNativeMethod(this, value === 0 ? 0 : value);
          return this;
        } : KEY == 'delete' ? function (key) {
          return IS_WEAK && !isObject(key) ? false : uncurriedNativeMethod(this, key === 0 ? 0 : key);
        } : KEY == 'get' ? function get(key) {
          return IS_WEAK && !isObject(key) ? undefined : uncurriedNativeMethod(this, key === 0 ? 0 : key);
        } : KEY == 'has' ? function has(key) {
          return IS_WEAK && !isObject(key) ? false : uncurriedNativeMethod(this, key === 0 ? 0 : key);
        } : function set(key, value) {
          uncurriedNativeMethod(this, key === 0 ? 0 : key, value);
          return this;
        }
      );
    };

    var REPLACE = isForced_1(
      CONSTRUCTOR_NAME,
      !isCallable(NativeConstructor) || !(IS_WEAK || NativePrototype.forEach && !fails(function () {
        new NativeConstructor().entries().next();
      }))
    );

    if (REPLACE) {
      // create collection constructor
      Constructor = common.getConstructor(wrapper, CONSTRUCTOR_NAME, IS_MAP, ADDER);
      internalMetadata.enable();
    } else if (isForced_1(CONSTRUCTOR_NAME, true)) {
      var instance = new Constructor();
      // early implementations not supports chaining
      var HASNT_CHAINING = instance[ADDER](IS_WEAK ? {} : -0, 1) != instance;
      // V8 ~ Chromium 40- weak-collections throws on primitives, but should return false
      var THROWS_ON_PRIMITIVES = fails(function () { instance.has(1); });
      // most early implementations doesn't supports iterables, most modern - not close it correctly
      // eslint-disable-next-line no-new -- required for testing
      var ACCEPT_ITERABLES = checkCorrectnessOfIteration(function (iterable) { new NativeConstructor(iterable); });
      // for early implementations -0 and +0 not the same
      var BUGGY_ZERO = !IS_WEAK && fails(function () {
        // V8 ~ Chromium 42- fails only with 5+ elements
        var $instance = new NativeConstructor();
        var index = 5;
        while (index--) $instance[ADDER](index, index);
        return !$instance.has(-0);
      });

      if (!ACCEPT_ITERABLES) {
        Constructor = wrapper(function (dummy, iterable) {
          anInstance(dummy, NativePrototype);
          var that = inheritIfRequired(new NativeConstructor(), dummy, Constructor);
          if (iterable != undefined) iterate(iterable, that[ADDER], { that: that, AS_ENTRIES: IS_MAP });
          return that;
        });
        Constructor.prototype = NativePrototype;
        NativePrototype.constructor = Constructor;
      }

      if (THROWS_ON_PRIMITIVES || BUGGY_ZERO) {
        fixMethod('delete');
        fixMethod('has');
        IS_MAP && fixMethod('get');
      }

      if (BUGGY_ZERO || HASNT_CHAINING) fixMethod(ADDER);

      // weak collections should not contains .clear method
      if (IS_WEAK && NativePrototype.clear) delete NativePrototype.clear;
    }

    exported[CONSTRUCTOR_NAME] = Constructor;
    _export({ global: true, forced: Constructor != NativeConstructor }, exported);

    setToStringTag(Constructor, CONSTRUCTOR_NAME);

    if (!IS_WEAK) common.setStrong(Constructor, CONSTRUCTOR_NAME, IS_MAP);

    return Constructor;
  };

  var getWeakData = internalMetadata.getWeakData;








  var setInternalState$2 = internalState.set;
  var internalStateGetterFor = internalState.getterFor;
  var find = arrayIteration.find;
  var findIndex = arrayIteration.findIndex;
  var splice = functionUncurryThis([].splice);
  var id$1 = 0;

  // fallback for uncaught frozen keys
  var uncaughtFrozenStore = function (store) {
    return store.frozen || (store.frozen = new UncaughtFrozenStore());
  };

  var UncaughtFrozenStore = function () {
    this.entries = [];
  };

  var findUncaughtFrozen = function (store, key) {
    return find(store.entries, function (it) {
      return it[0] === key;
    });
  };

  UncaughtFrozenStore.prototype = {
    get: function (key) {
      var entry = findUncaughtFrozen(this, key);
      if (entry) return entry[1];
    },
    has: function (key) {
      return !!findUncaughtFrozen(this, key);
    },
    set: function (key, value) {
      var entry = findUncaughtFrozen(this, key);
      if (entry) entry[1] = value;
      else this.entries.push([key, value]);
    },
    'delete': function (key) {
      var index = findIndex(this.entries, function (it) {
        return it[0] === key;
      });
      if (~index) splice(this.entries, index, 1);
      return !!~index;
    }
  };

  var collectionWeak = {
    getConstructor: function (wrapper, CONSTRUCTOR_NAME, IS_MAP, ADDER) {
      var Constructor = wrapper(function (that, iterable) {
        anInstance(that, Prototype);
        setInternalState$2(that, {
          type: CONSTRUCTOR_NAME,
          id: id$1++,
          frozen: undefined
        });
        if (iterable != undefined) iterate(iterable, that[ADDER], { that: that, AS_ENTRIES: IS_MAP });
      });

      var Prototype = Constructor.prototype;

      var getInternalState = internalStateGetterFor(CONSTRUCTOR_NAME);

      var define = function (that, key, value) {
        var state = getInternalState(that);
        var data = getWeakData(anObject(key), true);
        if (data === true) uncaughtFrozenStore(state).set(key, value);
        else data[state.id] = value;
        return that;
      };

      redefineAll(Prototype, {
        // `{ WeakMap, WeakSet }.prototype.delete(key)` methods
        // https://tc39.es/ecma262/#sec-weakmap.prototype.delete
        // https://tc39.es/ecma262/#sec-weakset.prototype.delete
        'delete': function (key) {
          var state = getInternalState(this);
          if (!isObject(key)) return false;
          var data = getWeakData(key);
          if (data === true) return uncaughtFrozenStore(state)['delete'](key);
          return data && hasOwnProperty_1(data, state.id) && delete data[state.id];
        },
        // `{ WeakMap, WeakSet }.prototype.has(key)` methods
        // https://tc39.es/ecma262/#sec-weakmap.prototype.has
        // https://tc39.es/ecma262/#sec-weakset.prototype.has
        has: function has(key) {
          var state = getInternalState(this);
          if (!isObject(key)) return false;
          var data = getWeakData(key);
          if (data === true) return uncaughtFrozenStore(state).has(key);
          return data && hasOwnProperty_1(data, state.id);
        }
      });

      redefineAll(Prototype, IS_MAP ? {
        // `WeakMap.prototype.get(key)` method
        // https://tc39.es/ecma262/#sec-weakmap.prototype.get
        get: function get(key) {
          var state = getInternalState(this);
          if (isObject(key)) {
            var data = getWeakData(key);
            if (data === true) return uncaughtFrozenStore(state).get(key);
            return data ? data[state.id] : undefined;
          }
        },
        // `WeakMap.prototype.set(key, value)` method
        // https://tc39.es/ecma262/#sec-weakmap.prototype.set
        set: function set(key, value) {
          return define(this, key, value);
        }
      } : {
        // `WeakSet.prototype.add(value)` method
        // https://tc39.es/ecma262/#sec-weakset.prototype.add
        add: function add(value) {
          return define(this, value, true);
        }
      });

      return Constructor;
    }
  };

  var enforceIternalState = internalState.enforce;


  var IS_IE11 = !global_1.ActiveXObject && 'ActiveXObject' in global_1;
  var InternalWeakMap;

  var wrapper = function (init) {
    return function WeakMap() {
      return init(this, arguments.length ? arguments[0] : undefined);
    };
  };

  // `WeakMap` constructor
  // https://tc39.es/ecma262/#sec-weakmap-constructor
  var $WeakMap = collection('WeakMap', wrapper, collectionWeak);

  // IE11 WeakMap frozen keys fix
  // We can't use feature detection because it crash some old IE builds
  // https://github.com/zloirock/core-js/issues/485
  if (nativeWeakMap && IS_IE11) {
    InternalWeakMap = collectionWeak.getConstructor(wrapper, 'WeakMap', true);
    internalMetadata.enable();
    var WeakMapPrototype = $WeakMap.prototype;
    var nativeDelete = functionUncurryThis(WeakMapPrototype['delete']);
    var nativeHas = functionUncurryThis(WeakMapPrototype.has);
    var nativeGet = functionUncurryThis(WeakMapPrototype.get);
    var nativeSet = functionUncurryThis(WeakMapPrototype.set);
    redefineAll(WeakMapPrototype, {
      'delete': function (key) {
        if (isObject(key) && !objectIsExtensible(key)) {
          var state = enforceIternalState(this);
          if (!state.frozen) state.frozen = new InternalWeakMap();
          return nativeDelete(this, key) || state.frozen['delete'](key);
        } return nativeDelete(this, key);
      },
      has: function has(key) {
        if (isObject(key) && !objectIsExtensible(key)) {
          var state = enforceIternalState(this);
          if (!state.frozen) state.frozen = new InternalWeakMap();
          return nativeHas(this, key) || state.frozen.has(key);
        } return nativeHas(this, key);
      },
      get: function get(key) {
        if (isObject(key) && !objectIsExtensible(key)) {
          var state = enforceIternalState(this);
          if (!state.frozen) state.frozen = new InternalWeakMap();
          return nativeHas(this, key) ? nativeGet(this, key) : state.frozen.get(key);
        } return nativeGet(this, key);
      },
      set: function set(key, value) {
        if (isObject(key) && !objectIsExtensible(key)) {
          var state = enforceIternalState(this);
          if (!state.frozen) state.frozen = new InternalWeakMap();
          nativeHas(this, key) ? nativeSet(this, key, value) : state.frozen.set(key, value);
        } else nativeSet(this, key, value);
        return this;
      }
    });
  }

  var ITERATOR$6 = wellKnownSymbol('iterator');
  var TO_STRING_TAG$3 = wellKnownSymbol('toStringTag');
  var ArrayValues = es_array_iterator.values;

  var handlePrototype$1 = function (CollectionPrototype, COLLECTION_NAME) {
    if (CollectionPrototype) {
      // some Chrome versions have non-configurable methods on DOMTokenList
      if (CollectionPrototype[ITERATOR$6] !== ArrayValues) try {
        createNonEnumerableProperty(CollectionPrototype, ITERATOR$6, ArrayValues);
      } catch (error) {
        CollectionPrototype[ITERATOR$6] = ArrayValues;
      }
      if (!CollectionPrototype[TO_STRING_TAG$3]) {
        createNonEnumerableProperty(CollectionPrototype, TO_STRING_TAG$3, COLLECTION_NAME);
      }
      if (domIterables[COLLECTION_NAME]) for (var METHOD_NAME in es_array_iterator) {
        // some Chrome versions have non-configurable methods on DOMTokenList
        if (CollectionPrototype[METHOD_NAME] !== es_array_iterator[METHOD_NAME]) try {
          createNonEnumerableProperty(CollectionPrototype, METHOD_NAME, es_array_iterator[METHOD_NAME]);
        } catch (error) {
          CollectionPrototype[METHOD_NAME] = es_array_iterator[METHOD_NAME];
        }
      }
    }
  };

  for (var COLLECTION_NAME$1 in domIterables) {
    handlePrototype$1(global_1[COLLECTION_NAME$1] && global_1[COLLECTION_NAME$1].prototype, COLLECTION_NAME$1);
  }

  handlePrototype$1(domTokenListPrototype, 'DOMTokenList');

  /**
   * lodash (Custom Build) <https://lodash.com/>
   * Build: `lodash modularize exports="npm" -o ./`
   * Copyright jQuery Foundation and other contributors <https://jquery.org/>
   * Released under MIT license <https://lodash.com/license>
   * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
   * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   */

  /** Used as the `TypeError` message for "Functions" methods. */
  var FUNC_ERROR_TEXT = 'Expected a function';

  /** Used as references for various `Number` constants. */
  var NAN = 0 / 0;

  /** `Object#toString` result references. */
  var symbolTag = '[object Symbol]';

  /** Used to match leading and trailing whitespace. */
  var reTrim = /^\s+|\s+$/g;

  /** Used to detect bad signed hexadecimal string values. */
  var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

  /** Used to detect binary string values. */
  var reIsBinary = /^0b[01]+$/i;

  /** Used to detect octal string values. */
  var reIsOctal = /^0o[0-7]+$/i;

  /** Built-in method references without a dependency on `root`. */
  var freeParseInt = parseInt;

  /** Detect free variable `global` from Node.js. */
  var freeGlobal = typeof commonjsGlobal$1 == 'object' && commonjsGlobal$1 && commonjsGlobal$1.Object === Object && commonjsGlobal$1;

  /** Detect free variable `self`. */
  var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

  /** Used as a reference to the global object. */
  var root = freeGlobal || freeSelf || Function('return this')();

  /** Used for built-in method references. */
  var objectProto = Object.prototype;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var objectToString$1 = objectProto.toString;

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeMax = Math.max,
      nativeMin = Math.min;

  /**
   * Gets the timestamp of the number of milliseconds that have elapsed since
   * the Unix epoch (1 January 1970 00:00:00 UTC).
   *
   * @static
   * @memberOf _
   * @since 2.4.0
   * @category Date
   * @returns {number} Returns the timestamp.
   * @example
   *
   * _.defer(function(stamp) {
   *   console.log(_.now() - stamp);
   * }, _.now());
   * // => Logs the number of milliseconds it took for the deferred invocation.
   */
  var now = function() {
    return root.Date.now();
  };

  /**
   * Creates a debounced function that delays invoking `func` until after `wait`
   * milliseconds have elapsed since the last time the debounced function was
   * invoked. The debounced function comes with a `cancel` method to cancel
   * delayed `func` invocations and a `flush` method to immediately invoke them.
   * Provide `options` to indicate whether `func` should be invoked on the
   * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
   * with the last arguments provided to the debounced function. Subsequent
   * calls to the debounced function return the result of the last `func`
   * invocation.
   *
   * **Note:** If `leading` and `trailing` options are `true`, `func` is
   * invoked on the trailing edge of the timeout only if the debounced function
   * is invoked more than once during the `wait` timeout.
   *
   * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
   * until to the next tick, similar to `setTimeout` with a timeout of `0`.
   *
   * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
   * for details over the differences between `_.debounce` and `_.throttle`.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Function
   * @param {Function} func The function to debounce.
   * @param {number} [wait=0] The number of milliseconds to delay.
   * @param {Object} [options={}] The options object.
   * @param {boolean} [options.leading=false]
   *  Specify invoking on the leading edge of the timeout.
   * @param {number} [options.maxWait]
   *  The maximum time `func` is allowed to be delayed before it's invoked.
   * @param {boolean} [options.trailing=true]
   *  Specify invoking on the trailing edge of the timeout.
   * @returns {Function} Returns the new debounced function.
   * @example
   *
   * // Avoid costly calculations while the window size is in flux.
   * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
   *
   * // Invoke `sendMail` when clicked, debouncing subsequent calls.
   * jQuery(element).on('click', _.debounce(sendMail, 300, {
   *   'leading': true,
   *   'trailing': false
   * }));
   *
   * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
   * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
   * var source = new EventSource('/stream');
   * jQuery(source).on('message', debounced);
   *
   * // Cancel the trailing debounced invocation.
   * jQuery(window).on('popstate', debounced.cancel);
   */
  function debounce(func, wait, options) {
    var lastArgs,
        lastThis,
        maxWait,
        result,
        timerId,
        lastCallTime,
        lastInvokeTime = 0,
        leading = false,
        maxing = false,
        trailing = true;

    if (typeof func != 'function') {
      throw new TypeError(FUNC_ERROR_TEXT);
    }
    wait = toNumber(wait) || 0;
    if (isObject$1(options)) {
      leading = !!options.leading;
      maxing = 'maxWait' in options;
      maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
      trailing = 'trailing' in options ? !!options.trailing : trailing;
    }

    function invokeFunc(time) {
      var args = lastArgs,
          thisArg = lastThis;

      lastArgs = lastThis = undefined;
      lastInvokeTime = time;
      result = func.apply(thisArg, args);
      return result;
    }

    function leadingEdge(time) {
      // Reset any `maxWait` timer.
      lastInvokeTime = time;
      // Start the timer for the trailing edge.
      timerId = setTimeout(timerExpired, wait);
      // Invoke the leading edge.
      return leading ? invokeFunc(time) : result;
    }

    function remainingWait(time) {
      var timeSinceLastCall = time - lastCallTime,
          timeSinceLastInvoke = time - lastInvokeTime,
          result = wait - timeSinceLastCall;

      return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result;
    }

    function shouldInvoke(time) {
      var timeSinceLastCall = time - lastCallTime,
          timeSinceLastInvoke = time - lastInvokeTime;

      // Either this is the first call, activity has stopped and we're at the
      // trailing edge, the system time has gone backwards and we're treating
      // it as the trailing edge, or we've hit the `maxWait` limit.
      return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
        (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
    }

    function timerExpired() {
      var time = now();
      if (shouldInvoke(time)) {
        return trailingEdge(time);
      }
      // Restart the timer.
      timerId = setTimeout(timerExpired, remainingWait(time));
    }

    function trailingEdge(time) {
      timerId = undefined;

      // Only invoke if we have `lastArgs` which means `func` has been
      // debounced at least once.
      if (trailing && lastArgs) {
        return invokeFunc(time);
      }
      lastArgs = lastThis = undefined;
      return result;
    }

    function cancel() {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      lastInvokeTime = 0;
      lastArgs = lastCallTime = lastThis = timerId = undefined;
    }

    function flush() {
      return timerId === undefined ? result : trailingEdge(now());
    }

    function debounced() {
      var time = now(),
          isInvoking = shouldInvoke(time);

      lastArgs = arguments;
      lastThis = this;
      lastCallTime = time;

      if (isInvoking) {
        if (timerId === undefined) {
          return leadingEdge(lastCallTime);
        }
        if (maxing) {
          // Handle invocations in a tight loop.
          timerId = setTimeout(timerExpired, wait);
          return invokeFunc(lastCallTime);
        }
      }
      if (timerId === undefined) {
        timerId = setTimeout(timerExpired, wait);
      }
      return result;
    }
    debounced.cancel = cancel;
    debounced.flush = flush;
    return debounced;
  }

  /**
   * Creates a throttled function that only invokes `func` at most once per
   * every `wait` milliseconds. The throttled function comes with a `cancel`
   * method to cancel delayed `func` invocations and a `flush` method to
   * immediately invoke them. Provide `options` to indicate whether `func`
   * should be invoked on the leading and/or trailing edge of the `wait`
   * timeout. The `func` is invoked with the last arguments provided to the
   * throttled function. Subsequent calls to the throttled function return the
   * result of the last `func` invocation.
   *
   * **Note:** If `leading` and `trailing` options are `true`, `func` is
   * invoked on the trailing edge of the timeout only if the throttled function
   * is invoked more than once during the `wait` timeout.
   *
   * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
   * until to the next tick, similar to `setTimeout` with a timeout of `0`.
   *
   * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
   * for details over the differences between `_.throttle` and `_.debounce`.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Function
   * @param {Function} func The function to throttle.
   * @param {number} [wait=0] The number of milliseconds to throttle invocations to.
   * @param {Object} [options={}] The options object.
   * @param {boolean} [options.leading=true]
   *  Specify invoking on the leading edge of the timeout.
   * @param {boolean} [options.trailing=true]
   *  Specify invoking on the trailing edge of the timeout.
   * @returns {Function} Returns the new throttled function.
   * @example
   *
   * // Avoid excessively updating the position while scrolling.
   * jQuery(window).on('scroll', _.throttle(updatePosition, 100));
   *
   * // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
   * var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
   * jQuery(element).on('click', throttled);
   *
   * // Cancel the trailing throttled invocation.
   * jQuery(window).on('popstate', throttled.cancel);
   */
  function throttle(func, wait, options) {
    var leading = true,
        trailing = true;

    if (typeof func != 'function') {
      throw new TypeError(FUNC_ERROR_TEXT);
    }
    if (isObject$1(options)) {
      leading = 'leading' in options ? !!options.leading : leading;
      trailing = 'trailing' in options ? !!options.trailing : trailing;
    }
    return debounce(func, wait, {
      'leading': leading,
      'maxWait': wait,
      'trailing': trailing
    });
  }

  /**
   * Checks if `value` is the
   * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
   * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(_.noop);
   * // => true
   *
   * _.isObject(null);
   * // => false
   */
  function isObject$1(value) {
    var type = typeof value;
    return !!value && (type == 'object' || type == 'function');
  }

  /**
   * Checks if `value` is object-like. A value is object-like if it's not `null`
   * and has a `typeof` result of "object".
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
   * @example
   *
   * _.isObjectLike({});
   * // => true
   *
   * _.isObjectLike([1, 2, 3]);
   * // => true
   *
   * _.isObjectLike(_.noop);
   * // => false
   *
   * _.isObjectLike(null);
   * // => false
   */
  function isObjectLike(value) {
    return !!value && typeof value == 'object';
  }

  /**
   * Checks if `value` is classified as a `Symbol` primitive or object.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
   * @example
   *
   * _.isSymbol(Symbol.iterator);
   * // => true
   *
   * _.isSymbol('abc');
   * // => false
   */
  function isSymbol$1(value) {
    return typeof value == 'symbol' ||
      (isObjectLike(value) && objectToString$1.call(value) == symbolTag);
  }

  /**
   * Converts `value` to a number.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to process.
   * @returns {number} Returns the number.
   * @example
   *
   * _.toNumber(3.2);
   * // => 3.2
   *
   * _.toNumber(Number.MIN_VALUE);
   * // => 5e-324
   *
   * _.toNumber(Infinity);
   * // => Infinity
   *
   * _.toNumber('3.2');
   * // => 3.2
   */
  function toNumber(value) {
    if (typeof value == 'number') {
      return value;
    }
    if (isSymbol$1(value)) {
      return NAN;
    }
    if (isObject$1(value)) {
      var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
      value = isObject$1(other) ? (other + '') : other;
    }
    if (typeof value != 'string') {
      return value === 0 ? value : +value;
    }
    value = value.replace(reTrim, '');
    var isBinary = reIsBinary.test(value);
    return (isBinary || reIsOctal.test(value))
      ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
      : (reIsBadHex.test(value) ? NAN : +value);
  }

  var lodash_throttle = throttle;

  /**
   * lodash (Custom Build) <https://lodash.com/>
   * Build: `lodash modularize exports="npm" -o ./`
   * Copyright jQuery Foundation and other contributors <https://jquery.org/>
   * Released under MIT license <https://lodash.com/license>
   * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
   * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   */

  /** Used as the `TypeError` message for "Functions" methods. */
  var FUNC_ERROR_TEXT$1 = 'Expected a function';

  /** Used as references for various `Number` constants. */
  var NAN$1 = 0 / 0;

  /** `Object#toString` result references. */
  var symbolTag$1 = '[object Symbol]';

  /** Used to match leading and trailing whitespace. */
  var reTrim$1 = /^\s+|\s+$/g;

  /** Used to detect bad signed hexadecimal string values. */
  var reIsBadHex$1 = /^[-+]0x[0-9a-f]+$/i;

  /** Used to detect binary string values. */
  var reIsBinary$1 = /^0b[01]+$/i;

  /** Used to detect octal string values. */
  var reIsOctal$1 = /^0o[0-7]+$/i;

  /** Built-in method references without a dependency on `root`. */
  var freeParseInt$1 = parseInt;

  /** Detect free variable `global` from Node.js. */
  var freeGlobal$1 = typeof commonjsGlobal$1 == 'object' && commonjsGlobal$1 && commonjsGlobal$1.Object === Object && commonjsGlobal$1;

  /** Detect free variable `self`. */
  var freeSelf$1 = typeof self == 'object' && self && self.Object === Object && self;

  /** Used as a reference to the global object. */
  var root$1 = freeGlobal$1 || freeSelf$1 || Function('return this')();

  /** Used for built-in method references. */
  var objectProto$1 = Object.prototype;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var objectToString$2 = objectProto$1.toString;

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeMax$1 = Math.max,
      nativeMin$1 = Math.min;

  /**
   * Gets the timestamp of the number of milliseconds that have elapsed since
   * the Unix epoch (1 January 1970 00:00:00 UTC).
   *
   * @static
   * @memberOf _
   * @since 2.4.0
   * @category Date
   * @returns {number} Returns the timestamp.
   * @example
   *
   * _.defer(function(stamp) {
   *   console.log(_.now() - stamp);
   * }, _.now());
   * // => Logs the number of milliseconds it took for the deferred invocation.
   */
  var now$1 = function() {
    return root$1.Date.now();
  };

  /**
   * Creates a debounced function that delays invoking `func` until after `wait`
   * milliseconds have elapsed since the last time the debounced function was
   * invoked. The debounced function comes with a `cancel` method to cancel
   * delayed `func` invocations and a `flush` method to immediately invoke them.
   * Provide `options` to indicate whether `func` should be invoked on the
   * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
   * with the last arguments provided to the debounced function. Subsequent
   * calls to the debounced function return the result of the last `func`
   * invocation.
   *
   * **Note:** If `leading` and `trailing` options are `true`, `func` is
   * invoked on the trailing edge of the timeout only if the debounced function
   * is invoked more than once during the `wait` timeout.
   *
   * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
   * until to the next tick, similar to `setTimeout` with a timeout of `0`.
   *
   * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
   * for details over the differences between `_.debounce` and `_.throttle`.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Function
   * @param {Function} func The function to debounce.
   * @param {number} [wait=0] The number of milliseconds to delay.
   * @param {Object} [options={}] The options object.
   * @param {boolean} [options.leading=false]
   *  Specify invoking on the leading edge of the timeout.
   * @param {number} [options.maxWait]
   *  The maximum time `func` is allowed to be delayed before it's invoked.
   * @param {boolean} [options.trailing=true]
   *  Specify invoking on the trailing edge of the timeout.
   * @returns {Function} Returns the new debounced function.
   * @example
   *
   * // Avoid costly calculations while the window size is in flux.
   * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
   *
   * // Invoke `sendMail` when clicked, debouncing subsequent calls.
   * jQuery(element).on('click', _.debounce(sendMail, 300, {
   *   'leading': true,
   *   'trailing': false
   * }));
   *
   * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
   * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
   * var source = new EventSource('/stream');
   * jQuery(source).on('message', debounced);
   *
   * // Cancel the trailing debounced invocation.
   * jQuery(window).on('popstate', debounced.cancel);
   */
  function debounce$1(func, wait, options) {
    var lastArgs,
        lastThis,
        maxWait,
        result,
        timerId,
        lastCallTime,
        lastInvokeTime = 0,
        leading = false,
        maxing = false,
        trailing = true;

    if (typeof func != 'function') {
      throw new TypeError(FUNC_ERROR_TEXT$1);
    }
    wait = toNumber$1(wait) || 0;
    if (isObject$2(options)) {
      leading = !!options.leading;
      maxing = 'maxWait' in options;
      maxWait = maxing ? nativeMax$1(toNumber$1(options.maxWait) || 0, wait) : maxWait;
      trailing = 'trailing' in options ? !!options.trailing : trailing;
    }

    function invokeFunc(time) {
      var args = lastArgs,
          thisArg = lastThis;

      lastArgs = lastThis = undefined;
      lastInvokeTime = time;
      result = func.apply(thisArg, args);
      return result;
    }

    function leadingEdge(time) {
      // Reset any `maxWait` timer.
      lastInvokeTime = time;
      // Start the timer for the trailing edge.
      timerId = setTimeout(timerExpired, wait);
      // Invoke the leading edge.
      return leading ? invokeFunc(time) : result;
    }

    function remainingWait(time) {
      var timeSinceLastCall = time - lastCallTime,
          timeSinceLastInvoke = time - lastInvokeTime,
          result = wait - timeSinceLastCall;

      return maxing ? nativeMin$1(result, maxWait - timeSinceLastInvoke) : result;
    }

    function shouldInvoke(time) {
      var timeSinceLastCall = time - lastCallTime,
          timeSinceLastInvoke = time - lastInvokeTime;

      // Either this is the first call, activity has stopped and we're at the
      // trailing edge, the system time has gone backwards and we're treating
      // it as the trailing edge, or we've hit the `maxWait` limit.
      return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
        (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
    }

    function timerExpired() {
      var time = now$1();
      if (shouldInvoke(time)) {
        return trailingEdge(time);
      }
      // Restart the timer.
      timerId = setTimeout(timerExpired, remainingWait(time));
    }

    function trailingEdge(time) {
      timerId = undefined;

      // Only invoke if we have `lastArgs` which means `func` has been
      // debounced at least once.
      if (trailing && lastArgs) {
        return invokeFunc(time);
      }
      lastArgs = lastThis = undefined;
      return result;
    }

    function cancel() {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      lastInvokeTime = 0;
      lastArgs = lastCallTime = lastThis = timerId = undefined;
    }

    function flush() {
      return timerId === undefined ? result : trailingEdge(now$1());
    }

    function debounced() {
      var time = now$1(),
          isInvoking = shouldInvoke(time);

      lastArgs = arguments;
      lastThis = this;
      lastCallTime = time;

      if (isInvoking) {
        if (timerId === undefined) {
          return leadingEdge(lastCallTime);
        }
        if (maxing) {
          // Handle invocations in a tight loop.
          timerId = setTimeout(timerExpired, wait);
          return invokeFunc(lastCallTime);
        }
      }
      if (timerId === undefined) {
        timerId = setTimeout(timerExpired, wait);
      }
      return result;
    }
    debounced.cancel = cancel;
    debounced.flush = flush;
    return debounced;
  }

  /**
   * Checks if `value` is the
   * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
   * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(_.noop);
   * // => true
   *
   * _.isObject(null);
   * // => false
   */
  function isObject$2(value) {
    var type = typeof value;
    return !!value && (type == 'object' || type == 'function');
  }

  /**
   * Checks if `value` is object-like. A value is object-like if it's not `null`
   * and has a `typeof` result of "object".
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
   * @example
   *
   * _.isObjectLike({});
   * // => true
   *
   * _.isObjectLike([1, 2, 3]);
   * // => true
   *
   * _.isObjectLike(_.noop);
   * // => false
   *
   * _.isObjectLike(null);
   * // => false
   */
  function isObjectLike$1(value) {
    return !!value && typeof value == 'object';
  }

  /**
   * Checks if `value` is classified as a `Symbol` primitive or object.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
   * @example
   *
   * _.isSymbol(Symbol.iterator);
   * // => true
   *
   * _.isSymbol('abc');
   * // => false
   */
  function isSymbol$2(value) {
    return typeof value == 'symbol' ||
      (isObjectLike$1(value) && objectToString$2.call(value) == symbolTag$1);
  }

  /**
   * Converts `value` to a number.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to process.
   * @returns {number} Returns the number.
   * @example
   *
   * _.toNumber(3.2);
   * // => 3.2
   *
   * _.toNumber(Number.MIN_VALUE);
   * // => 5e-324
   *
   * _.toNumber(Infinity);
   * // => Infinity
   *
   * _.toNumber('3.2');
   * // => 3.2
   */
  function toNumber$1(value) {
    if (typeof value == 'number') {
      return value;
    }
    if (isSymbol$2(value)) {
      return NAN$1;
    }
    if (isObject$2(value)) {
      var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
      value = isObject$2(other) ? (other + '') : other;
    }
    if (typeof value != 'string') {
      return value === 0 ? value : +value;
    }
    value = value.replace(reTrim$1, '');
    var isBinary = reIsBinary$1.test(value);
    return (isBinary || reIsOctal$1.test(value))
      ? freeParseInt$1(value.slice(2), isBinary ? 2 : 8)
      : (reIsBadHex$1.test(value) ? NAN$1 : +value);
  }

  var lodash_debounce = debounce$1;

  /**
   * lodash (Custom Build) <https://lodash.com/>
   * Build: `lodash modularize exports="npm" -o ./`
   * Copyright jQuery Foundation and other contributors <https://jquery.org/>
   * Released under MIT license <https://lodash.com/license>
   * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
   * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   */

  /** Used as the `TypeError` message for "Functions" methods. */
  var FUNC_ERROR_TEXT$2 = 'Expected a function';

  /** Used to stand-in for `undefined` hash values. */
  var HASH_UNDEFINED = '__lodash_hash_undefined__';

  /** `Object#toString` result references. */
  var funcTag = '[object Function]',
      genTag = '[object GeneratorFunction]';

  /**
   * Used to match `RegExp`
   * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
   */
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

  /** Used to detect host constructors (Safari). */
  var reIsHostCtor = /^\[object .+?Constructor\]$/;

  /** Detect free variable `global` from Node.js. */
  var freeGlobal$2 = typeof commonjsGlobal$1 == 'object' && commonjsGlobal$1 && commonjsGlobal$1.Object === Object && commonjsGlobal$1;

  /** Detect free variable `self`. */
  var freeSelf$2 = typeof self == 'object' && self && self.Object === Object && self;

  /** Used as a reference to the global object. */
  var root$2 = freeGlobal$2 || freeSelf$2 || Function('return this')();

  /**
   * Gets the value at `key` of `object`.
   *
   * @private
   * @param {Object} [object] The object to query.
   * @param {string} key The key of the property to get.
   * @returns {*} Returns the property value.
   */
  function getValue(object, key) {
    return object == null ? undefined : object[key];
  }

  /**
   * Checks if `value` is a host object in IE < 9.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
   */
  function isHostObject(value) {
    // Many host objects are `Object` objects that can coerce to strings
    // despite having improperly defined `toString` methods.
    var result = false;
    if (value != null && typeof value.toString != 'function') {
      try {
        result = !!(value + '');
      } catch (e) {}
    }
    return result;
  }

  /** Used for built-in method references. */
  var arrayProto = Array.prototype,
      funcProto = Function.prototype,
      objectProto$2 = Object.prototype;

  /** Used to detect overreaching core-js shims. */
  var coreJsData = root$2['__core-js_shared__'];

  /** Used to detect methods masquerading as native. */
  var maskSrcKey = (function() {
    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
    return uid ? ('Symbol(src)_1.' + uid) : '';
  }());

  /** Used to resolve the decompiled source of functions. */
  var funcToString = funcProto.toString;

  /** Used to check objects for own properties. */
  var hasOwnProperty$3 = objectProto$2.hasOwnProperty;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var objectToString$3 = objectProto$2.toString;

  /** Used to detect if a method is native. */
  var reIsNative = RegExp('^' +
    funcToString.call(hasOwnProperty$3).replace(reRegExpChar, '\\$&')
    .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
  );

  /** Built-in value references. */
  var splice$1 = arrayProto.splice;

  /* Built-in method references that are verified to be native. */
  var Map = getNative(root$2, 'Map'),
      nativeCreate = getNative(Object, 'create');

  /**
   * Creates a hash object.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function Hash(entries) {
    var index = -1,
        length = entries ? entries.length : 0;

    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }

  /**
   * Removes all key-value entries from the hash.
   *
   * @private
   * @name clear
   * @memberOf Hash
   */
  function hashClear() {
    this.__data__ = nativeCreate ? nativeCreate(null) : {};
  }

  /**
   * Removes `key` and its value from the hash.
   *
   * @private
   * @name delete
   * @memberOf Hash
   * @param {Object} hash The hash to modify.
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */
  function hashDelete(key) {
    return this.has(key) && delete this.__data__[key];
  }

  /**
   * Gets the hash value for `key`.
   *
   * @private
   * @name get
   * @memberOf Hash
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function hashGet(key) {
    var data = this.__data__;
    if (nativeCreate) {
      var result = data[key];
      return result === HASH_UNDEFINED ? undefined : result;
    }
    return hasOwnProperty$3.call(data, key) ? data[key] : undefined;
  }

  /**
   * Checks if a hash value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf Hash
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function hashHas(key) {
    var data = this.__data__;
    return nativeCreate ? data[key] !== undefined : hasOwnProperty$3.call(data, key);
  }

  /**
   * Sets the hash `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf Hash
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the hash instance.
   */
  function hashSet(key, value) {
    var data = this.__data__;
    data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
    return this;
  }

  // Add methods to `Hash`.
  Hash.prototype.clear = hashClear;
  Hash.prototype['delete'] = hashDelete;
  Hash.prototype.get = hashGet;
  Hash.prototype.has = hashHas;
  Hash.prototype.set = hashSet;

  /**
   * Creates an list cache object.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function ListCache(entries) {
    var index = -1,
        length = entries ? entries.length : 0;

    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }

  /**
   * Removes all key-value entries from the list cache.
   *
   * @private
   * @name clear
   * @memberOf ListCache
   */
  function listCacheClear() {
    this.__data__ = [];
  }

  /**
   * Removes `key` and its value from the list cache.
   *
   * @private
   * @name delete
   * @memberOf ListCache
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */
  function listCacheDelete(key) {
    var data = this.__data__,
        index = assocIndexOf(data, key);

    if (index < 0) {
      return false;
    }
    var lastIndex = data.length - 1;
    if (index == lastIndex) {
      data.pop();
    } else {
      splice$1.call(data, index, 1);
    }
    return true;
  }

  /**
   * Gets the list cache value for `key`.
   *
   * @private
   * @name get
   * @memberOf ListCache
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function listCacheGet(key) {
    var data = this.__data__,
        index = assocIndexOf(data, key);

    return index < 0 ? undefined : data[index][1];
  }

  /**
   * Checks if a list cache value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf ListCache
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function listCacheHas(key) {
    return assocIndexOf(this.__data__, key) > -1;
  }

  /**
   * Sets the list cache `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf ListCache
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the list cache instance.
   */
  function listCacheSet(key, value) {
    var data = this.__data__,
        index = assocIndexOf(data, key);

    if (index < 0) {
      data.push([key, value]);
    } else {
      data[index][1] = value;
    }
    return this;
  }

  // Add methods to `ListCache`.
  ListCache.prototype.clear = listCacheClear;
  ListCache.prototype['delete'] = listCacheDelete;
  ListCache.prototype.get = listCacheGet;
  ListCache.prototype.has = listCacheHas;
  ListCache.prototype.set = listCacheSet;

  /**
   * Creates a map cache object to store key-value pairs.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function MapCache(entries) {
    var index = -1,
        length = entries ? entries.length : 0;

    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }

  /**
   * Removes all key-value entries from the map.
   *
   * @private
   * @name clear
   * @memberOf MapCache
   */
  function mapCacheClear() {
    this.__data__ = {
      'hash': new Hash,
      'map': new (Map || ListCache),
      'string': new Hash
    };
  }

  /**
   * Removes `key` and its value from the map.
   *
   * @private
   * @name delete
   * @memberOf MapCache
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */
  function mapCacheDelete(key) {
    return getMapData(this, key)['delete'](key);
  }

  /**
   * Gets the map value for `key`.
   *
   * @private
   * @name get
   * @memberOf MapCache
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function mapCacheGet(key) {
    return getMapData(this, key).get(key);
  }

  /**
   * Checks if a map value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf MapCache
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function mapCacheHas(key) {
    return getMapData(this, key).has(key);
  }

  /**
   * Sets the map `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf MapCache
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the map cache instance.
   */
  function mapCacheSet(key, value) {
    getMapData(this, key).set(key, value);
    return this;
  }

  // Add methods to `MapCache`.
  MapCache.prototype.clear = mapCacheClear;
  MapCache.prototype['delete'] = mapCacheDelete;
  MapCache.prototype.get = mapCacheGet;
  MapCache.prototype.has = mapCacheHas;
  MapCache.prototype.set = mapCacheSet;

  /**
   * Gets the index at which the `key` is found in `array` of key-value pairs.
   *
   * @private
   * @param {Array} array The array to inspect.
   * @param {*} key The key to search for.
   * @returns {number} Returns the index of the matched value, else `-1`.
   */
  function assocIndexOf(array, key) {
    var length = array.length;
    while (length--) {
      if (eq(array[length][0], key)) {
        return length;
      }
    }
    return -1;
  }

  /**
   * The base implementation of `_.isNative` without bad shim checks.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a native function,
   *  else `false`.
   */
  function baseIsNative(value) {
    if (!isObject$3(value) || isMasked(value)) {
      return false;
    }
    var pattern = (isFunction(value) || isHostObject(value)) ? reIsNative : reIsHostCtor;
    return pattern.test(toSource(value));
  }

  /**
   * Gets the data for `map`.
   *
   * @private
   * @param {Object} map The map to query.
   * @param {string} key The reference key.
   * @returns {*} Returns the map data.
   */
  function getMapData(map, key) {
    var data = map.__data__;
    return isKeyable(key)
      ? data[typeof key == 'string' ? 'string' : 'hash']
      : data.map;
  }

  /**
   * Gets the native function at `key` of `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @param {string} key The key of the method to get.
   * @returns {*} Returns the function if it's native, else `undefined`.
   */
  function getNative(object, key) {
    var value = getValue(object, key);
    return baseIsNative(value) ? value : undefined;
  }

  /**
   * Checks if `value` is suitable for use as unique object key.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
   */
  function isKeyable(value) {
    var type = typeof value;
    return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
      ? (value !== '__proto__')
      : (value === null);
  }

  /**
   * Checks if `func` has its source masked.
   *
   * @private
   * @param {Function} func The function to check.
   * @returns {boolean} Returns `true` if `func` is masked, else `false`.
   */
  function isMasked(func) {
    return !!maskSrcKey && (maskSrcKey in func);
  }

  /**
   * Converts `func` to its source code.
   *
   * @private
   * @param {Function} func The function to process.
   * @returns {string} Returns the source code.
   */
  function toSource(func) {
    if (func != null) {
      try {
        return funcToString.call(func);
      } catch (e) {}
      try {
        return (func + '');
      } catch (e) {}
    }
    return '';
  }

  /**
   * Creates a function that memoizes the result of `func`. If `resolver` is
   * provided, it determines the cache key for storing the result based on the
   * arguments provided to the memoized function. By default, the first argument
   * provided to the memoized function is used as the map cache key. The `func`
   * is invoked with the `this` binding of the memoized function.
   *
   * **Note:** The cache is exposed as the `cache` property on the memoized
   * function. Its creation may be customized by replacing the `_.memoize.Cache`
   * constructor with one whose instances implement the
   * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
   * method interface of `delete`, `get`, `has`, and `set`.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Function
   * @param {Function} func The function to have its output memoized.
   * @param {Function} [resolver] The function to resolve the cache key.
   * @returns {Function} Returns the new memoized function.
   * @example
   *
   * var object = { 'a': 1, 'b': 2 };
   * var other = { 'c': 3, 'd': 4 };
   *
   * var values = _.memoize(_.values);
   * values(object);
   * // => [1, 2]
   *
   * values(other);
   * // => [3, 4]
   *
   * object.a = 2;
   * values(object);
   * // => [1, 2]
   *
   * // Modify the result cache.
   * values.cache.set(object, ['a', 'b']);
   * values(object);
   * // => ['a', 'b']
   *
   * // Replace `_.memoize.Cache`.
   * _.memoize.Cache = WeakMap;
   */
  function memoize(func, resolver) {
    if (typeof func != 'function' || (resolver && typeof resolver != 'function')) {
      throw new TypeError(FUNC_ERROR_TEXT$2);
    }
    var memoized = function() {
      var args = arguments,
          key = resolver ? resolver.apply(this, args) : args[0],
          cache = memoized.cache;

      if (cache.has(key)) {
        return cache.get(key);
      }
      var result = func.apply(this, args);
      memoized.cache = cache.set(key, result);
      return result;
    };
    memoized.cache = new (memoize.Cache || MapCache);
    return memoized;
  }

  // Assign cache to `_.memoize`.
  memoize.Cache = MapCache;

  /**
   * Performs a
   * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
   * comparison between two values to determine if they are equivalent.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to compare.
   * @param {*} other The other value to compare.
   * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
   * @example
   *
   * var object = { 'a': 1 };
   * var other = { 'a': 1 };
   *
   * _.eq(object, object);
   * // => true
   *
   * _.eq(object, other);
   * // => false
   *
   * _.eq('a', 'a');
   * // => true
   *
   * _.eq('a', Object('a'));
   * // => false
   *
   * _.eq(NaN, NaN);
   * // => true
   */
  function eq(value, other) {
    return value === other || (value !== value && other !== other);
  }

  /**
   * Checks if `value` is classified as a `Function` object.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a function, else `false`.
   * @example
   *
   * _.isFunction(_);
   * // => true
   *
   * _.isFunction(/abc/);
   * // => false
   */
  function isFunction(value) {
    // The use of `Object#toString` avoids issues with the `typeof` operator
    // in Safari 8-9 which returns 'object' for typed array and other constructors.
    var tag = isObject$3(value) ? objectToString$3.call(value) : '';
    return tag == funcTag || tag == genTag;
  }

  /**
   * Checks if `value` is the
   * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
   * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(_.noop);
   * // => true
   *
   * _.isObject(null);
   * // => false
   */
  function isObject$3(value) {
    var type = typeof value;
    return !!value && (type == 'object' || type == 'function');
  }

  var lodash_memoize = memoize;

  var resizeObservers = [];

  var hasActiveObservations = function () {
      return resizeObservers.some(function (ro) { return ro.activeTargets.length > 0; });
  };

  var hasSkippedObservations = function () {
      return resizeObservers.some(function (ro) { return ro.skippedTargets.length > 0; });
  };

  var msg = 'ResizeObserver loop completed with undelivered notifications.';
  var deliverResizeLoopError = function () {
      var event;
      if (typeof ErrorEvent === 'function') {
          event = new ErrorEvent('error', {
              message: msg
          });
      }
      else {
          event = document.createEvent('Event');
          event.initEvent('error', false, false);
          event.message = msg;
      }
      window.dispatchEvent(event);
  };

  var ResizeObserverBoxOptions;
  (function (ResizeObserverBoxOptions) {
      ResizeObserverBoxOptions["BORDER_BOX"] = "border-box";
      ResizeObserverBoxOptions["CONTENT_BOX"] = "content-box";
      ResizeObserverBoxOptions["DEVICE_PIXEL_CONTENT_BOX"] = "device-pixel-content-box";
  })(ResizeObserverBoxOptions || (ResizeObserverBoxOptions = {}));

  var freeze = function (obj) { return Object.freeze(obj); };

  var ResizeObserverSize = (function () {
      function ResizeObserverSize(inlineSize, blockSize) {
          this.inlineSize = inlineSize;
          this.blockSize = blockSize;
          freeze(this);
      }
      return ResizeObserverSize;
  }());

  var DOMRectReadOnly = (function () {
      function DOMRectReadOnly(x, y, width, height) {
          this.x = x;
          this.y = y;
          this.width = width;
          this.height = height;
          this.top = this.y;
          this.left = this.x;
          this.bottom = this.top + this.height;
          this.right = this.left + this.width;
          return freeze(this);
      }
      DOMRectReadOnly.prototype.toJSON = function () {
          var _a = this, x = _a.x, y = _a.y, top = _a.top, right = _a.right, bottom = _a.bottom, left = _a.left, width = _a.width, height = _a.height;
          return { x: x, y: y, top: top, right: right, bottom: bottom, left: left, width: width, height: height };
      };
      DOMRectReadOnly.fromRect = function (rectangle) {
          return new DOMRectReadOnly(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
      };
      return DOMRectReadOnly;
  }());

  var isSVG = function (target) { return target instanceof SVGElement && 'getBBox' in target; };
  var isHidden = function (target) {
      if (isSVG(target)) {
          var _a = target.getBBox(), width = _a.width, height = _a.height;
          return !width && !height;
      }
      var _b = target, offsetWidth = _b.offsetWidth, offsetHeight = _b.offsetHeight;
      return !(offsetWidth || offsetHeight || target.getClientRects().length);
  };
  var isElement = function (obj) {
      var _a, _b;
      if (obj instanceof Element) {
          return true;
      }
      var scope = (_b = (_a = obj) === null || _a === void 0 ? void 0 : _a.ownerDocument) === null || _b === void 0 ? void 0 : _b.defaultView;
      return !!(scope && obj instanceof scope.Element);
  };
  var isReplacedElement = function (target) {
      switch (target.tagName) {
          case 'INPUT':
              if (target.type !== 'image') {
                  break;
              }
          case 'VIDEO':
          case 'AUDIO':
          case 'EMBED':
          case 'OBJECT':
          case 'CANVAS':
          case 'IFRAME':
          case 'IMG':
              return true;
      }
      return false;
  };

  var global$1 = typeof window !== 'undefined' ? window : {};

  var cache = new WeakMap();
  var scrollRegexp = /auto|scroll/;
  var verticalRegexp = /^tb|vertical/;
  var IE = (/msie|trident/i).test(global$1.navigator && global$1.navigator.userAgent);
  var parseDimension = function (pixel) { return parseFloat(pixel || '0'); };
  var size = function (inlineSize, blockSize, switchSizes) {
      if (inlineSize === void 0) { inlineSize = 0; }
      if (blockSize === void 0) { blockSize = 0; }
      if (switchSizes === void 0) { switchSizes = false; }
      return new ResizeObserverSize((switchSizes ? blockSize : inlineSize) || 0, (switchSizes ? inlineSize : blockSize) || 0);
  };
  var zeroBoxes = freeze({
      devicePixelContentBoxSize: size(),
      borderBoxSize: size(),
      contentBoxSize: size(),
      contentRect: new DOMRectReadOnly(0, 0, 0, 0)
  });
  var calculateBoxSizes = function (target, forceRecalculation) {
      if (forceRecalculation === void 0) { forceRecalculation = false; }
      if (cache.has(target) && !forceRecalculation) {
          return cache.get(target);
      }
      if (isHidden(target)) {
          cache.set(target, zeroBoxes);
          return zeroBoxes;
      }
      var cs = getComputedStyle(target);
      var svg = isSVG(target) && target.ownerSVGElement && target.getBBox();
      var removePadding = !IE && cs.boxSizing === 'border-box';
      var switchSizes = verticalRegexp.test(cs.writingMode || '');
      var canScrollVertically = !svg && scrollRegexp.test(cs.overflowY || '');
      var canScrollHorizontally = !svg && scrollRegexp.test(cs.overflowX || '');
      var paddingTop = svg ? 0 : parseDimension(cs.paddingTop);
      var paddingRight = svg ? 0 : parseDimension(cs.paddingRight);
      var paddingBottom = svg ? 0 : parseDimension(cs.paddingBottom);
      var paddingLeft = svg ? 0 : parseDimension(cs.paddingLeft);
      var borderTop = svg ? 0 : parseDimension(cs.borderTopWidth);
      var borderRight = svg ? 0 : parseDimension(cs.borderRightWidth);
      var borderBottom = svg ? 0 : parseDimension(cs.borderBottomWidth);
      var borderLeft = svg ? 0 : parseDimension(cs.borderLeftWidth);
      var horizontalPadding = paddingLeft + paddingRight;
      var verticalPadding = paddingTop + paddingBottom;
      var horizontalBorderArea = borderLeft + borderRight;
      var verticalBorderArea = borderTop + borderBottom;
      var horizontalScrollbarThickness = !canScrollHorizontally ? 0 : target.offsetHeight - verticalBorderArea - target.clientHeight;
      var verticalScrollbarThickness = !canScrollVertically ? 0 : target.offsetWidth - horizontalBorderArea - target.clientWidth;
      var widthReduction = removePadding ? horizontalPadding + horizontalBorderArea : 0;
      var heightReduction = removePadding ? verticalPadding + verticalBorderArea : 0;
      var contentWidth = svg ? svg.width : parseDimension(cs.width) - widthReduction - verticalScrollbarThickness;
      var contentHeight = svg ? svg.height : parseDimension(cs.height) - heightReduction - horizontalScrollbarThickness;
      var borderBoxWidth = contentWidth + horizontalPadding + verticalScrollbarThickness + horizontalBorderArea;
      var borderBoxHeight = contentHeight + verticalPadding + horizontalScrollbarThickness + verticalBorderArea;
      var boxes = freeze({
          devicePixelContentBoxSize: size(Math.round(contentWidth * devicePixelRatio), Math.round(contentHeight * devicePixelRatio), switchSizes),
          borderBoxSize: size(borderBoxWidth, borderBoxHeight, switchSizes),
          contentBoxSize: size(contentWidth, contentHeight, switchSizes),
          contentRect: new DOMRectReadOnly(paddingLeft, paddingTop, contentWidth, contentHeight)
      });
      cache.set(target, boxes);
      return boxes;
  };
  var calculateBoxSize = function (target, observedBox, forceRecalculation) {
      var _a = calculateBoxSizes(target, forceRecalculation), borderBoxSize = _a.borderBoxSize, contentBoxSize = _a.contentBoxSize, devicePixelContentBoxSize = _a.devicePixelContentBoxSize;
      switch (observedBox) {
          case ResizeObserverBoxOptions.DEVICE_PIXEL_CONTENT_BOX:
              return devicePixelContentBoxSize;
          case ResizeObserverBoxOptions.BORDER_BOX:
              return borderBoxSize;
          default:
              return contentBoxSize;
      }
  };

  var ResizeObserverEntry = (function () {
      function ResizeObserverEntry(target) {
          var boxes = calculateBoxSizes(target);
          this.target = target;
          this.contentRect = boxes.contentRect;
          this.borderBoxSize = freeze([boxes.borderBoxSize]);
          this.contentBoxSize = freeze([boxes.contentBoxSize]);
          this.devicePixelContentBoxSize = freeze([boxes.devicePixelContentBoxSize]);
      }
      return ResizeObserverEntry;
  }());

  var calculateDepthForNode = function (node) {
      if (isHidden(node)) {
          return Infinity;
      }
      var depth = 0;
      var parent = node.parentNode;
      while (parent) {
          depth += 1;
          parent = parent.parentNode;
      }
      return depth;
  };

  var broadcastActiveObservations = function () {
      var shallowestDepth = Infinity;
      var callbacks = [];
      resizeObservers.forEach(function processObserver(ro) {
          if (ro.activeTargets.length === 0) {
              return;
          }
          var entries = [];
          ro.activeTargets.forEach(function processTarget(ot) {
              var entry = new ResizeObserverEntry(ot.target);
              var targetDepth = calculateDepthForNode(ot.target);
              entries.push(entry);
              ot.lastReportedSize = calculateBoxSize(ot.target, ot.observedBox);
              if (targetDepth < shallowestDepth) {
                  shallowestDepth = targetDepth;
              }
          });
          callbacks.push(function resizeObserverCallback() {
              ro.callback.call(ro.observer, entries, ro.observer);
          });
          ro.activeTargets.splice(0, ro.activeTargets.length);
      });
      for (var _i = 0, callbacks_1 = callbacks; _i < callbacks_1.length; _i++) {
          var callback = callbacks_1[_i];
          callback();
      }
      return shallowestDepth;
  };

  var gatherActiveObservationsAtDepth = function (depth) {
      resizeObservers.forEach(function processObserver(ro) {
          ro.activeTargets.splice(0, ro.activeTargets.length);
          ro.skippedTargets.splice(0, ro.skippedTargets.length);
          ro.observationTargets.forEach(function processTarget(ot) {
              if (ot.isActive()) {
                  if (calculateDepthForNode(ot.target) > depth) {
                      ro.activeTargets.push(ot);
                  }
                  else {
                      ro.skippedTargets.push(ot);
                  }
              }
          });
      });
  };

  var process$1 = function () {
      var depth = 0;
      gatherActiveObservationsAtDepth(depth);
      while (hasActiveObservations()) {
          depth = broadcastActiveObservations();
          gatherActiveObservationsAtDepth(depth);
      }
      if (hasSkippedObservations()) {
          deliverResizeLoopError();
      }
      return depth > 0;
  };

  var trigger;
  var callbacks = [];
  var notify = function () { return callbacks.splice(0).forEach(function (cb) { return cb(); }); };
  var queueMicroTask = function (callback) {
      if (!trigger) {
          var toggle_1 = 0;
          var el_1 = document.createTextNode('');
          var config = { characterData: true };
          new MutationObserver(function () { return notify(); }).observe(el_1, config);
          trigger = function () { el_1.textContent = "" + (toggle_1 ? toggle_1-- : toggle_1++); };
      }
      callbacks.push(callback);
      trigger();
  };

  var queueResizeObserver = function (cb) {
      queueMicroTask(function ResizeObserver() {
          requestAnimationFrame(cb);
      });
  };

  var watching = 0;
  var isWatching = function () { return !!watching; };
  var CATCH_PERIOD = 250;
  var observerConfig = { attributes: true, characterData: true, childList: true, subtree: true };
  var events = [
      'resize',
      'load',
      'transitionend',
      'animationend',
      'animationstart',
      'animationiteration',
      'keyup',
      'keydown',
      'mouseup',
      'mousedown',
      'mouseover',
      'mouseout',
      'blur',
      'focus'
  ];
  var time = function (timeout) {
      if (timeout === void 0) { timeout = 0; }
      return Date.now() + timeout;
  };
  var scheduled = false;
  var Scheduler = (function () {
      function Scheduler() {
          var _this = this;
          this.stopped = true;
          this.listener = function () { return _this.schedule(); };
      }
      Scheduler.prototype.run = function (timeout) {
          var _this = this;
          if (timeout === void 0) { timeout = CATCH_PERIOD; }
          if (scheduled) {
              return;
          }
          scheduled = true;
          var until = time(timeout);
          queueResizeObserver(function () {
              var elementsHaveResized = false;
              try {
                  elementsHaveResized = process$1();
              }
              finally {
                  scheduled = false;
                  timeout = until - time();
                  if (!isWatching()) {
                      return;
                  }
                  if (elementsHaveResized) {
                      _this.run(1000);
                  }
                  else if (timeout > 0) {
                      _this.run(timeout);
                  }
                  else {
                      _this.start();
                  }
              }
          });
      };
      Scheduler.prototype.schedule = function () {
          this.stop();
          this.run();
      };
      Scheduler.prototype.observe = function () {
          var _this = this;
          var cb = function () { return _this.observer && _this.observer.observe(document.body, observerConfig); };
          document.body ? cb() : global$1.addEventListener('DOMContentLoaded', cb);
      };
      Scheduler.prototype.start = function () {
          var _this = this;
          if (this.stopped) {
              this.stopped = false;
              this.observer = new MutationObserver(this.listener);
              this.observe();
              events.forEach(function (name) { return global$1.addEventListener(name, _this.listener, true); });
          }
      };
      Scheduler.prototype.stop = function () {
          var _this = this;
          if (!this.stopped) {
              this.observer && this.observer.disconnect();
              events.forEach(function (name) { return global$1.removeEventListener(name, _this.listener, true); });
              this.stopped = true;
          }
      };
      return Scheduler;
  }());
  var scheduler = new Scheduler();
  var updateCount = function (n) {
      !watching && n > 0 && scheduler.start();
      watching += n;
      !watching && scheduler.stop();
  };

  var skipNotifyOnElement = function (target) {
      return !isSVG(target)
          && !isReplacedElement(target)
          && getComputedStyle(target).display === 'inline';
  };
  var ResizeObservation = (function () {
      function ResizeObservation(target, observedBox) {
          this.target = target;
          this.observedBox = observedBox || ResizeObserverBoxOptions.CONTENT_BOX;
          this.lastReportedSize = {
              inlineSize: 0,
              blockSize: 0
          };
      }
      ResizeObservation.prototype.isActive = function () {
          var size = calculateBoxSize(this.target, this.observedBox, true);
          if (skipNotifyOnElement(this.target)) {
              this.lastReportedSize = size;
          }
          if (this.lastReportedSize.inlineSize !== size.inlineSize
              || this.lastReportedSize.blockSize !== size.blockSize) {
              return true;
          }
          return false;
      };
      return ResizeObservation;
  }());

  var ResizeObserverDetail = (function () {
      function ResizeObserverDetail(resizeObserver, callback) {
          this.activeTargets = [];
          this.skippedTargets = [];
          this.observationTargets = [];
          this.observer = resizeObserver;
          this.callback = callback;
      }
      return ResizeObserverDetail;
  }());

  var observerMap = new WeakMap();
  var getObservationIndex = function (observationTargets, target) {
      for (var i = 0; i < observationTargets.length; i += 1) {
          if (observationTargets[i].target === target) {
              return i;
          }
      }
      return -1;
  };
  var ResizeObserverController = (function () {
      function ResizeObserverController() {
      }
      ResizeObserverController.connect = function (resizeObserver, callback) {
          var detail = new ResizeObserverDetail(resizeObserver, callback);
          observerMap.set(resizeObserver, detail);
      };
      ResizeObserverController.observe = function (resizeObserver, target, options) {
          var detail = observerMap.get(resizeObserver);
          var firstObservation = detail.observationTargets.length === 0;
          if (getObservationIndex(detail.observationTargets, target) < 0) {
              firstObservation && resizeObservers.push(detail);
              detail.observationTargets.push(new ResizeObservation(target, options && options.box));
              updateCount(1);
              scheduler.schedule();
          }
      };
      ResizeObserverController.unobserve = function (resizeObserver, target) {
          var detail = observerMap.get(resizeObserver);
          var index = getObservationIndex(detail.observationTargets, target);
          var lastObservation = detail.observationTargets.length === 1;
          if (index >= 0) {
              lastObservation && resizeObservers.splice(resizeObservers.indexOf(detail), 1);
              detail.observationTargets.splice(index, 1);
              updateCount(-1);
          }
      };
      ResizeObserverController.disconnect = function (resizeObserver) {
          var _this = this;
          var detail = observerMap.get(resizeObserver);
          detail.observationTargets.slice().forEach(function (ot) { return _this.unobserve(resizeObserver, ot.target); });
          detail.activeTargets.splice(0, detail.activeTargets.length);
      };
      return ResizeObserverController;
  }());

  var ResizeObserver$1 = (function () {
      function ResizeObserver(callback) {
          if (arguments.length === 0) {
              throw new TypeError("Failed to construct 'ResizeObserver': 1 argument required, but only 0 present.");
          }
          if (typeof callback !== 'function') {
              throw new TypeError("Failed to construct 'ResizeObserver': The callback provided as parameter 1 is not a function.");
          }
          ResizeObserverController.connect(this, callback);
      }
      ResizeObserver.prototype.observe = function (target, options) {
          if (arguments.length === 0) {
              throw new TypeError("Failed to execute 'observe' on 'ResizeObserver': 1 argument required, but only 0 present.");
          }
          if (!isElement(target)) {
              throw new TypeError("Failed to execute 'observe' on 'ResizeObserver': parameter 1 is not of type 'Element");
          }
          ResizeObserverController.observe(this, target, options);
      };
      ResizeObserver.prototype.unobserve = function (target) {
          if (arguments.length === 0) {
              throw new TypeError("Failed to execute 'unobserve' on 'ResizeObserver': 1 argument required, but only 0 present.");
          }
          if (!isElement(target)) {
              throw new TypeError("Failed to execute 'unobserve' on 'ResizeObserver': parameter 1 is not of type 'Element");
          }
          ResizeObserverController.unobserve(this, target);
      };
      ResizeObserver.prototype.disconnect = function () {
          ResizeObserverController.disconnect(this);
      };
      ResizeObserver.toString = function () {
          return 'function ResizeObserver () { [polyfill code] }';
      };
      return ResizeObserver;
  }());

  var TypeError$c = global_1.TypeError;

  // `Array.prototype.{ reduce, reduceRight }` methods implementation
  var createMethod$4 = function (IS_RIGHT) {
    return function (that, callbackfn, argumentsLength, memo) {
      aCallable(callbackfn);
      var O = toObject$1(that);
      var self = indexedObject(O);
      var length = lengthOfArrayLike(O);
      var index = IS_RIGHT ? length - 1 : 0;
      var i = IS_RIGHT ? -1 : 1;
      if (argumentsLength < 2) while (true) {
        if (index in self) {
          memo = self[index];
          index += i;
          break;
        }
        index += i;
        if (IS_RIGHT ? index < 0 : length <= index) {
          throw TypeError$c('Reduce of empty array with no initial value');
        }
      }
      for (;IS_RIGHT ? index >= 0 : length > index; index += i) if (index in self) {
        memo = callbackfn(memo, self[index], index, O);
      }
      return memo;
    };
  };

  var arrayReduce = {
    // `Array.prototype.reduce` method
    // https://tc39.es/ecma262/#sec-array.prototype.reduce
    left: createMethod$4(false),
    // `Array.prototype.reduceRight` method
    // https://tc39.es/ecma262/#sec-array.prototype.reduceright
    right: createMethod$4(true)
  };

  var engineIsNode = classofRaw(global_1.process) == 'process';

  var $reduce = arrayReduce.left;




  var STRICT_METHOD$1 = arrayMethodIsStrict('reduce');
  // Chrome 80-82 has a critical bug
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1049982
  var CHROME_BUG = !engineIsNode && engineV8Version > 79 && engineV8Version < 83;

  // `Array.prototype.reduce` method
  // https://tc39.es/ecma262/#sec-array.prototype.reduce
  _export({ target: 'Array', proto: true, forced: !STRICT_METHOD$1 || CHROME_BUG }, {
    reduce: function reduce(callbackfn /* , initialValue */) {
      var length = arguments.length;
      return $reduce(this, callbackfn, length, length > 1 ? arguments[1] : undefined);
    }
  });

  var FUNCTION_NAME_EXISTS = functionName.EXISTS;

  var defineProperty$3 = objectDefineProperty.f;

  var FunctionPrototype$2 = Function.prototype;
  var functionToString$1 = functionUncurryThis(FunctionPrototype$2.toString);
  var nameRE = /function\b(?:\s|\/\*[\S\s]*?\*\/|\/\/[^\n\r]*[\n\r]+)*([^\s(/]*)/;
  var regExpExec = functionUncurryThis(nameRE.exec);
  var NAME = 'name';

  // Function instances `.name` property
  // https://tc39.es/ecma262/#sec-function-instances-name
  if (descriptors && !FUNCTION_NAME_EXISTS) {
    defineProperty$3(FunctionPrototype$2, NAME, {
      configurable: true,
      get: function () {
        try {
          return regExpExec(nameRE, functionToString$1(this))[1];
        } catch (error) {
          return '';
        }
      }
    });
  }

  // `RegExp.prototype.flags` getter implementation
  // https://tc39.es/ecma262/#sec-get-regexp.prototype.flags
  var regexpFlags = function () {
    var that = anObject(this);
    var result = '';
    if (that.global) result += 'g';
    if (that.ignoreCase) result += 'i';
    if (that.multiline) result += 'm';
    if (that.dotAll) result += 's';
    if (that.unicode) result += 'u';
    if (that.sticky) result += 'y';
    return result;
  };

  // babel-minify and Closure Compiler transpiles RegExp('a', 'y') -> /a/y and it causes SyntaxError
  var $RegExp = global_1.RegExp;

  var UNSUPPORTED_Y = fails(function () {
    var re = $RegExp('a', 'y');
    re.lastIndex = 2;
    return re.exec('abcd') != null;
  });

  // UC Browser bug
  // https://github.com/zloirock/core-js/issues/1008
  var MISSED_STICKY = UNSUPPORTED_Y || fails(function () {
    return !$RegExp('a', 'y').sticky;
  });

  var BROKEN_CARET = UNSUPPORTED_Y || fails(function () {
    // https://bugzilla.mozilla.org/show_bug.cgi?id=773687
    var re = $RegExp('^r', 'gy');
    re.lastIndex = 2;
    return re.exec('str') != null;
  });

  var regexpStickyHelpers = {
    BROKEN_CARET: BROKEN_CARET,
    MISSED_STICKY: MISSED_STICKY,
    UNSUPPORTED_Y: UNSUPPORTED_Y
  };

  // babel-minify and Closure Compiler transpiles RegExp('.', 's') -> /./s and it causes SyntaxError
  var $RegExp$1 = global_1.RegExp;

  var regexpUnsupportedDotAll = fails(function () {
    var re = $RegExp$1('.', 's');
    return !(re.dotAll && re.exec('\n') && re.flags === 's');
  });

  // babel-minify and Closure Compiler transpiles RegExp('(?<a>b)', 'g') -> /(?<a>b)/g and it causes SyntaxError
  var $RegExp$2 = global_1.RegExp;

  var regexpUnsupportedNcg = fails(function () {
    var re = $RegExp$2('(?<a>b)', 'g');
    return re.exec('b').groups.a !== 'b' ||
      'b'.replace(re, '$<a>c') !== 'bc';
  });

  /* eslint-disable regexp/no-empty-capturing-group, regexp/no-empty-group, regexp/no-lazy-ends -- testing */
  /* eslint-disable regexp/no-useless-quantifier -- testing */







  var getInternalState$2 = internalState.get;



  var nativeReplace = shared('native-string-replace', String.prototype.replace);
  var nativeExec = RegExp.prototype.exec;
  var patchedExec = nativeExec;
  var charAt$2 = functionUncurryThis(''.charAt);
  var indexOf$1 = functionUncurryThis(''.indexOf);
  var replace$1 = functionUncurryThis(''.replace);
  var stringSlice$2 = functionUncurryThis(''.slice);

  var UPDATES_LAST_INDEX_WRONG = (function () {
    var re1 = /a/;
    var re2 = /b*/g;
    functionCall(nativeExec, re1, 'a');
    functionCall(nativeExec, re2, 'a');
    return re1.lastIndex !== 0 || re2.lastIndex !== 0;
  })();

  var UNSUPPORTED_Y$1 = regexpStickyHelpers.BROKEN_CARET;

  // nonparticipating capturing group, copied from es5-shim's String#split patch.
  var NPCG_INCLUDED = /()??/.exec('')[1] !== undefined;

  var PATCH = UPDATES_LAST_INDEX_WRONG || NPCG_INCLUDED || UNSUPPORTED_Y$1 || regexpUnsupportedDotAll || regexpUnsupportedNcg;

  if (PATCH) {
    patchedExec = function exec(string) {
      var re = this;
      var state = getInternalState$2(re);
      var str = toString_1(string);
      var raw = state.raw;
      var result, reCopy, lastIndex, match, i, object, group;

      if (raw) {
        raw.lastIndex = re.lastIndex;
        result = functionCall(patchedExec, raw, str);
        re.lastIndex = raw.lastIndex;
        return result;
      }

      var groups = state.groups;
      var sticky = UNSUPPORTED_Y$1 && re.sticky;
      var flags = functionCall(regexpFlags, re);
      var source = re.source;
      var charsAdded = 0;
      var strCopy = str;

      if (sticky) {
        flags = replace$1(flags, 'y', '');
        if (indexOf$1(flags, 'g') === -1) {
          flags += 'g';
        }

        strCopy = stringSlice$2(str, re.lastIndex);
        // Support anchored sticky behavior.
        if (re.lastIndex > 0 && (!re.multiline || re.multiline && charAt$2(str, re.lastIndex - 1) !== '\n')) {
          source = '(?: ' + source + ')';
          strCopy = ' ' + strCopy;
          charsAdded++;
        }
        // ^(? + rx + ) is needed, in combination with some str slicing, to
        // simulate the 'y' flag.
        reCopy = new RegExp('^(?:' + source + ')', flags);
      }

      if (NPCG_INCLUDED) {
        reCopy = new RegExp('^' + source + '$(?!\\s)', flags);
      }
      if (UPDATES_LAST_INDEX_WRONG) lastIndex = re.lastIndex;

      match = functionCall(nativeExec, sticky ? reCopy : re, strCopy);

      if (sticky) {
        if (match) {
          match.input = stringSlice$2(match.input, charsAdded);
          match[0] = stringSlice$2(match[0], charsAdded);
          match.index = re.lastIndex;
          re.lastIndex += match[0].length;
        } else re.lastIndex = 0;
      } else if (UPDATES_LAST_INDEX_WRONG && match) {
        re.lastIndex = re.global ? match.index + match[0].length : lastIndex;
      }
      if (NPCG_INCLUDED && match && match.length > 1) {
        // Fix browsers whose `exec` methods don't consistently return `undefined`
        // for NPCG, like IE8. NOTE: This doesn' work for /(.?)?/
        functionCall(nativeReplace, match[0], reCopy, function () {
          for (i = 1; i < arguments.length - 2; i++) {
            if (arguments[i] === undefined) match[i] = undefined;
          }
        });
      }

      if (match && groups) {
        match.groups = object = objectCreate(null);
        for (i = 0; i < groups.length; i++) {
          group = groups[i];
          object[group[0]] = match[group[1]];
        }
      }

      return match;
    };
  }

  var regexpExec = patchedExec;

  // `RegExp.prototype.exec` method
  // https://tc39.es/ecma262/#sec-regexp.prototype.exec
  _export({ target: 'RegExp', proto: true, forced: /./.exec !== regexpExec }, {
    exec: regexpExec
  });

  // TODO: Remove from `core-js@4` since it's moved to entry points








  var SPECIES$2 = wellKnownSymbol('species');
  var RegExpPrototype = RegExp.prototype;

  var fixRegexpWellKnownSymbolLogic = function (KEY, exec, FORCED, SHAM) {
    var SYMBOL = wellKnownSymbol(KEY);

    var DELEGATES_TO_SYMBOL = !fails(function () {
      // String methods call symbol-named RegEp methods
      var O = {};
      O[SYMBOL] = function () { return 7; };
      return ''[KEY](O) != 7;
    });

    var DELEGATES_TO_EXEC = DELEGATES_TO_SYMBOL && !fails(function () {
      // Symbol-named RegExp methods call .exec
      var execCalled = false;
      var re = /a/;

      if (KEY === 'split') {
        // We can't use real regex here since it causes deoptimization
        // and serious performance degradation in V8
        // https://github.com/zloirock/core-js/issues/306
        re = {};
        // RegExp[@@split] doesn't call the regex's exec method, but first creates
        // a new one. We need to return the patched regex when creating the new one.
        re.constructor = {};
        re.constructor[SPECIES$2] = function () { return re; };
        re.flags = '';
        re[SYMBOL] = /./[SYMBOL];
      }

      re.exec = function () { execCalled = true; return null; };

      re[SYMBOL]('');
      return !execCalled;
    });

    if (
      !DELEGATES_TO_SYMBOL ||
      !DELEGATES_TO_EXEC ||
      FORCED
    ) {
      var uncurriedNativeRegExpMethod = functionUncurryThis(/./[SYMBOL]);
      var methods = exec(SYMBOL, ''[KEY], function (nativeMethod, regexp, str, arg2, forceStringMethod) {
        var uncurriedNativeMethod = functionUncurryThis(nativeMethod);
        var $exec = regexp.exec;
        if ($exec === regexpExec || $exec === RegExpPrototype.exec) {
          if (DELEGATES_TO_SYMBOL && !forceStringMethod) {
            // The native String method already delegates to @@method (this
            // polyfilled function), leasing to infinite recursion.
            // We avoid it by directly calling the native @@method method.
            return { done: true, value: uncurriedNativeRegExpMethod(regexp, str, arg2) };
          }
          return { done: true, value: uncurriedNativeMethod(str, regexp, arg2) };
        }
        return { done: false };
      });

      redefine(String.prototype, KEY, methods[0]);
      redefine(RegExpPrototype, SYMBOL, methods[1]);
    }

    if (SHAM) createNonEnumerableProperty(RegExpPrototype[SYMBOL], 'sham', true);
  };

  var charAt$3 = stringMultibyte.charAt;

  // `AdvanceStringIndex` abstract operation
  // https://tc39.es/ecma262/#sec-advancestringindex
  var advanceStringIndex = function (S, index, unicode) {
    return index + (unicode ? charAt$3(S, index).length : 1);
  };

  var TypeError$d = global_1.TypeError;

  // `RegExpExec` abstract operation
  // https://tc39.es/ecma262/#sec-regexpexec
  var regexpExecAbstract = function (R, S) {
    var exec = R.exec;
    if (isCallable(exec)) {
      var result = functionCall(exec, R, S);
      if (result !== null) anObject(result);
      return result;
    }
    if (classofRaw(R) === 'RegExp') return functionCall(regexpExec, R, S);
    throw TypeError$d('RegExp#exec called on incompatible receiver');
  };

  // @@match logic
  fixRegexpWellKnownSymbolLogic('match', function (MATCH, nativeMatch, maybeCallNative) {
    return [
      // `String.prototype.match` method
      // https://tc39.es/ecma262/#sec-string.prototype.match
      function match(regexp) {
        var O = requireObjectCoercible(this);
        var matcher = regexp == undefined ? undefined : getMethod(regexp, MATCH);
        return matcher ? functionCall(matcher, regexp, O) : new RegExp(regexp)[MATCH](toString_1(O));
      },
      // `RegExp.prototype[@@match]` method
      // https://tc39.es/ecma262/#sec-regexp.prototype-@@match
      function (string) {
        var rx = anObject(this);
        var S = toString_1(string);
        var res = maybeCallNative(nativeMatch, rx, S);

        if (res.done) return res.value;

        if (!rx.global) return regexpExecAbstract(rx, S);

        var fullUnicode = rx.unicode;
        rx.lastIndex = 0;
        var A = [];
        var n = 0;
        var result;
        while ((result = regexpExecAbstract(rx, S)) !== null) {
          var matchStr = toString_1(result[0]);
          A[n] = matchStr;
          if (matchStr === '') rx.lastIndex = advanceStringIndex(S, toLength(rx.lastIndex), fullUnicode);
          n++;
        }
        return n === 0 ? null : A;
      }
    ];
  });

  var FunctionPrototype$3 = Function.prototype;
  var apply = FunctionPrototype$3.apply;
  var bind$3 = FunctionPrototype$3.bind;
  var call$2 = FunctionPrototype$3.call;

  // eslint-disable-next-line es/no-reflect -- safe
  var functionApply = typeof Reflect == 'object' && Reflect.apply || (bind$3 ? call$2.bind(apply) : function () {
    return call$2.apply(apply, arguments);
  });

  var floor$1 = Math.floor;
  var charAt$4 = functionUncurryThis(''.charAt);
  var replace$2 = functionUncurryThis(''.replace);
  var stringSlice$3 = functionUncurryThis(''.slice);
  var SUBSTITUTION_SYMBOLS = /\$([$&'`]|\d{1,2}|<[^>]*>)/g;
  var SUBSTITUTION_SYMBOLS_NO_NAMED = /\$([$&'`]|\d{1,2})/g;

  // `GetSubstitution` abstract operation
  // https://tc39.es/ecma262/#sec-getsubstitution
  var getSubstitution = function (matched, str, position, captures, namedCaptures, replacement) {
    var tailPos = position + matched.length;
    var m = captures.length;
    var symbols = SUBSTITUTION_SYMBOLS_NO_NAMED;
    if (namedCaptures !== undefined) {
      namedCaptures = toObject$1(namedCaptures);
      symbols = SUBSTITUTION_SYMBOLS;
    }
    return replace$2(replacement, symbols, function (match, ch) {
      var capture;
      switch (charAt$4(ch, 0)) {
        case '$': return '$';
        case '&': return matched;
        case '`': return stringSlice$3(str, 0, position);
        case "'": return stringSlice$3(str, tailPos);
        case '<':
          capture = namedCaptures[stringSlice$3(ch, 1, -1)];
          break;
        default: // \d\d?
          var n = +ch;
          if (n === 0) return match;
          if (n > m) {
            var f = floor$1(n / 10);
            if (f === 0) return match;
            if (f <= m) return captures[f - 1] === undefined ? charAt$4(ch, 1) : captures[f - 1] + charAt$4(ch, 1);
            return match;
          }
          capture = captures[n - 1];
      }
      return capture === undefined ? '' : capture;
    });
  };

  var REPLACE = wellKnownSymbol('replace');
  var max$2 = Math.max;
  var min$2 = Math.min;
  var concat$2 = functionUncurryThis([].concat);
  var push$2 = functionUncurryThis([].push);
  var stringIndexOf = functionUncurryThis(''.indexOf);
  var stringSlice$4 = functionUncurryThis(''.slice);

  var maybeToString = function (it) {
    return it === undefined ? it : String(it);
  };

  // IE <= 11 replaces $0 with the whole match, as if it was $&
  // https://stackoverflow.com/questions/6024666/getting-ie-to-replace-a-regex-with-the-literal-string-0
  var REPLACE_KEEPS_$0 = (function () {
    // eslint-disable-next-line regexp/prefer-escape-replacement-dollar-char -- required for testing
    return 'a'.replace(/./, '$0') === '$0';
  })();

  // Safari <= 13.0.3(?) substitutes nth capture where n>m with an empty string
  var REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE = (function () {
    if (/./[REPLACE]) {
      return /./[REPLACE]('a', '$0') === '';
    }
    return false;
  })();

  var REPLACE_SUPPORTS_NAMED_GROUPS = !fails(function () {
    var re = /./;
    re.exec = function () {
      var result = [];
      result.groups = { a: '7' };
      return result;
    };
    // eslint-disable-next-line regexp/no-useless-dollar-replacements -- false positive
    return ''.replace(re, '$<a>') !== '7';
  });

  // @@replace logic
  fixRegexpWellKnownSymbolLogic('replace', function (_, nativeReplace, maybeCallNative) {
    var UNSAFE_SUBSTITUTE = REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE ? '$' : '$0';

    return [
      // `String.prototype.replace` method
      // https://tc39.es/ecma262/#sec-string.prototype.replace
      function replace(searchValue, replaceValue) {
        var O = requireObjectCoercible(this);
        var replacer = searchValue == undefined ? undefined : getMethod(searchValue, REPLACE);
        return replacer
          ? functionCall(replacer, searchValue, O, replaceValue)
          : functionCall(nativeReplace, toString_1(O), searchValue, replaceValue);
      },
      // `RegExp.prototype[@@replace]` method
      // https://tc39.es/ecma262/#sec-regexp.prototype-@@replace
      function (string, replaceValue) {
        var rx = anObject(this);
        var S = toString_1(string);

        if (
          typeof replaceValue == 'string' &&
          stringIndexOf(replaceValue, UNSAFE_SUBSTITUTE) === -1 &&
          stringIndexOf(replaceValue, '$<') === -1
        ) {
          var res = maybeCallNative(nativeReplace, rx, S, replaceValue);
          if (res.done) return res.value;
        }

        var functionalReplace = isCallable(replaceValue);
        if (!functionalReplace) replaceValue = toString_1(replaceValue);

        var global = rx.global;
        if (global) {
          var fullUnicode = rx.unicode;
          rx.lastIndex = 0;
        }
        var results = [];
        while (true) {
          var result = regexpExecAbstract(rx, S);
          if (result === null) break;

          push$2(results, result);
          if (!global) break;

          var matchStr = toString_1(result[0]);
          if (matchStr === '') rx.lastIndex = advanceStringIndex(S, toLength(rx.lastIndex), fullUnicode);
        }

        var accumulatedResult = '';
        var nextSourcePosition = 0;
        for (var i = 0; i < results.length; i++) {
          result = results[i];

          var matched = toString_1(result[0]);
          var position = max$2(min$2(toIntegerOrInfinity(result.index), S.length), 0);
          var captures = [];
          // NOTE: This is equivalent to
          //   captures = result.slice(1).map(maybeToString)
          // but for some reason `nativeSlice.call(result, 1, result.length)` (called in
          // the slice polyfill when slicing native arrays) "doesn't work" in safari 9 and
          // causes a crash (https://pastebin.com/N21QzeQA) when trying to debug it.
          for (var j = 1; j < result.length; j++) push$2(captures, maybeToString(result[j]));
          var namedCaptures = result.groups;
          if (functionalReplace) {
            var replacerArgs = concat$2([matched], captures, position, S);
            if (namedCaptures !== undefined) push$2(replacerArgs, namedCaptures);
            var replacement = toString_1(functionApply(replaceValue, undefined, replacerArgs));
          } else {
            replacement = getSubstitution(matched, S, position, captures, namedCaptures, replaceValue);
          }
          if (position >= nextSourcePosition) {
            accumulatedResult += stringSlice$4(S, nextSourcePosition, position) + replacement;
            nextSourcePosition = position + matched.length;
          }
        }
        return accumulatedResult + stringSlice$4(S, nextSourcePosition);
      }
    ];
  }, !REPLACE_SUPPORTS_NAMED_GROUPS || !REPLACE_KEEPS_$0 || REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE);

  /**
   * SimpleBar.js - v5.3.6
   * Scrollbars, simpler.
   * https://grsmto.github.io/simplebar/
   *
   * Made by Adrien Denat from a fork by Jonathan Nicol
   * Under MIT License
   */

  // Helper function to retrieve options from element attributes
  var getOptions = function getOptions(obj) {
    var options = Array.prototype.reduce.call(obj, function (acc, attribute) {
      var option = attribute.name.match(/data-simplebar-(.+)/);

      if (option) {
        var key = option[1].replace(/\W+(.)/g, function (x, chr) {
          return chr.toUpperCase();
        });

        switch (attribute.value) {
          case 'true':
            acc[key] = true;
            break;

          case 'false':
            acc[key] = false;
            break;

          case undefined:
            acc[key] = true;
            break;

          default:
            acc[key] = attribute.value;
        }
      }

      return acc;
    }, {});
    return options;
  };
  function getElementWindow(element) {
    if (!element || !element.ownerDocument || !element.ownerDocument.defaultView) {
      return window;
    }

    return element.ownerDocument.defaultView;
  }
  function getElementDocument(element) {
    if (!element || !element.ownerDocument) {
      return document;
    }

    return element.ownerDocument;
  }

  var cachedScrollbarWidth = null;
  var cachedDevicePixelRatio = null;

  if (canUseDom) {
    window.addEventListener('resize', function () {
      if (cachedDevicePixelRatio !== window.devicePixelRatio) {
        cachedDevicePixelRatio = window.devicePixelRatio;
        cachedScrollbarWidth = null;
      }
    });
  }

  function scrollbarWidth(el) {
    if (cachedScrollbarWidth === null) {
      var document = getElementDocument(el);

      if (typeof document === 'undefined') {
        cachedScrollbarWidth = 0;
        return cachedScrollbarWidth;
      }

      var body = document.body;
      var box = document.createElement('div');
      box.classList.add('simplebar-hide-scrollbar');
      body.appendChild(box);
      var width = box.getBoundingClientRect().right;
      body.removeChild(box);
      cachedScrollbarWidth = width;
    }

    return cachedScrollbarWidth;
  }

  var SimpleBar =
  /*#__PURE__*/
  function () {
    function SimpleBar(element, options) {
      var _this = this;

      this.onScroll = function () {
        var elWindow = getElementWindow(_this.el);

        if (!_this.scrollXTicking) {
          elWindow.requestAnimationFrame(_this.scrollX);
          _this.scrollXTicking = true;
        }

        if (!_this.scrollYTicking) {
          elWindow.requestAnimationFrame(_this.scrollY);
          _this.scrollYTicking = true;
        }
      };

      this.scrollX = function () {
        if (_this.axis.x.isOverflowing) {
          _this.showScrollbar('x');

          _this.positionScrollbar('x');
        }

        _this.scrollXTicking = false;
      };

      this.scrollY = function () {
        if (_this.axis.y.isOverflowing) {
          _this.showScrollbar('y');

          _this.positionScrollbar('y');
        }

        _this.scrollYTicking = false;
      };

      this.onMouseEnter = function () {
        _this.showScrollbar('x');

        _this.showScrollbar('y');
      };

      this.onMouseMove = function (e) {
        _this.mouseX = e.clientX;
        _this.mouseY = e.clientY;

        if (_this.axis.x.isOverflowing || _this.axis.x.forceVisible) {
          _this.onMouseMoveForAxis('x');
        }

        if (_this.axis.y.isOverflowing || _this.axis.y.forceVisible) {
          _this.onMouseMoveForAxis('y');
        }
      };

      this.onMouseLeave = function () {
        _this.onMouseMove.cancel();

        if (_this.axis.x.isOverflowing || _this.axis.x.forceVisible) {
          _this.onMouseLeaveForAxis('x');
        }

        if (_this.axis.y.isOverflowing || _this.axis.y.forceVisible) {
          _this.onMouseLeaveForAxis('y');
        }

        _this.mouseX = -1;
        _this.mouseY = -1;
      };

      this.onWindowResize = function () {
        // Recalculate scrollbarWidth in case it's a zoom
        _this.scrollbarWidth = _this.getScrollbarWidth();

        _this.hideNativeScrollbar();
      };

      this.hideScrollbars = function () {
        _this.axis.x.track.rect = _this.axis.x.track.el.getBoundingClientRect();
        _this.axis.y.track.rect = _this.axis.y.track.el.getBoundingClientRect();

        if (!_this.isWithinBounds(_this.axis.y.track.rect)) {
          _this.axis.y.scrollbar.el.classList.remove(_this.classNames.visible);

          _this.axis.y.isVisible = false;
        }

        if (!_this.isWithinBounds(_this.axis.x.track.rect)) {
          _this.axis.x.scrollbar.el.classList.remove(_this.classNames.visible);

          _this.axis.x.isVisible = false;
        }
      };

      this.onPointerEvent = function (e) {
        var isWithinTrackXBounds, isWithinTrackYBounds;
        _this.axis.x.track.rect = _this.axis.x.track.el.getBoundingClientRect();
        _this.axis.y.track.rect = _this.axis.y.track.el.getBoundingClientRect();

        if (_this.axis.x.isOverflowing || _this.axis.x.forceVisible) {
          isWithinTrackXBounds = _this.isWithinBounds(_this.axis.x.track.rect);
        }

        if (_this.axis.y.isOverflowing || _this.axis.y.forceVisible) {
          isWithinTrackYBounds = _this.isWithinBounds(_this.axis.y.track.rect);
        } // If any pointer event is called on the scrollbar


        if (isWithinTrackXBounds || isWithinTrackYBounds) {
          // Preventing the event's default action stops text being
          // selectable during the drag.
          e.preventDefault(); // Prevent event leaking

          e.stopPropagation();

          if (e.type === 'mousedown') {
            if (isWithinTrackXBounds) {
              _this.axis.x.scrollbar.rect = _this.axis.x.scrollbar.el.getBoundingClientRect();

              if (_this.isWithinBounds(_this.axis.x.scrollbar.rect)) {
                _this.onDragStart(e, 'x');
              } else {
                _this.onTrackClick(e, 'x');
              }
            }

            if (isWithinTrackYBounds) {
              _this.axis.y.scrollbar.rect = _this.axis.y.scrollbar.el.getBoundingClientRect();

              if (_this.isWithinBounds(_this.axis.y.scrollbar.rect)) {
                _this.onDragStart(e, 'y');
              } else {
                _this.onTrackClick(e, 'y');
              }
            }
          }
        }
      };

      this.drag = function (e) {
        var eventOffset;
        var track = _this.axis[_this.draggedAxis].track;
        var trackSize = track.rect[_this.axis[_this.draggedAxis].sizeAttr];
        var scrollbar = _this.axis[_this.draggedAxis].scrollbar;
        var contentSize = _this.contentWrapperEl[_this.axis[_this.draggedAxis].scrollSizeAttr];
        var hostSize = parseInt(_this.elStyles[_this.axis[_this.draggedAxis].sizeAttr], 10);
        e.preventDefault();
        e.stopPropagation();

        if (_this.draggedAxis === 'y') {
          eventOffset = e.pageY;
        } else {
          eventOffset = e.pageX;
        } // Calculate how far the user's mouse is from the top/left of the scrollbar (minus the dragOffset).


        var dragPos = eventOffset - track.rect[_this.axis[_this.draggedAxis].offsetAttr] - _this.axis[_this.draggedAxis].dragOffset; // Convert the mouse position into a percentage of the scrollbar height/width.

        var dragPerc = dragPos / (trackSize - scrollbar.size); // Scroll the content by the same percentage.

        var scrollPos = dragPerc * (contentSize - hostSize); // Fix browsers inconsistency on RTL

        if (_this.draggedAxis === 'x') {
          scrollPos = _this.isRtl && SimpleBar.getRtlHelpers().isRtlScrollbarInverted ? scrollPos - (trackSize + scrollbar.size) : scrollPos;
          scrollPos = _this.isRtl && SimpleBar.getRtlHelpers().isRtlScrollingInverted ? -scrollPos : scrollPos;
        }

        _this.contentWrapperEl[_this.axis[_this.draggedAxis].scrollOffsetAttr] = scrollPos;
      };

      this.onEndDrag = function (e) {
        var elDocument = getElementDocument(_this.el);
        var elWindow = getElementWindow(_this.el);
        e.preventDefault();
        e.stopPropagation();

        _this.el.classList.remove(_this.classNames.dragging);

        elDocument.removeEventListener('mousemove', _this.drag, true);
        elDocument.removeEventListener('mouseup', _this.onEndDrag, true);
        _this.removePreventClickId = elWindow.setTimeout(function () {
          // Remove these asynchronously so we still suppress click events
          // generated simultaneously with mouseup.
          elDocument.removeEventListener('click', _this.preventClick, true);
          elDocument.removeEventListener('dblclick', _this.preventClick, true);
          _this.removePreventClickId = null;
        });
      };

      this.preventClick = function (e) {
        e.preventDefault();
        e.stopPropagation();
      };

      this.el = element;
      this.minScrollbarWidth = 20;
      this.options = Object.assign({}, SimpleBar.defaultOptions, {}, options);
      this.classNames = Object.assign({}, SimpleBar.defaultOptions.classNames, {}, this.options.classNames);
      this.axis = {
        x: {
          scrollOffsetAttr: 'scrollLeft',
          sizeAttr: 'width',
          scrollSizeAttr: 'scrollWidth',
          offsetSizeAttr: 'offsetWidth',
          offsetAttr: 'left',
          overflowAttr: 'overflowX',
          dragOffset: 0,
          isOverflowing: true,
          isVisible: false,
          forceVisible: false,
          track: {},
          scrollbar: {}
        },
        y: {
          scrollOffsetAttr: 'scrollTop',
          sizeAttr: 'height',
          scrollSizeAttr: 'scrollHeight',
          offsetSizeAttr: 'offsetHeight',
          offsetAttr: 'top',
          overflowAttr: 'overflowY',
          dragOffset: 0,
          isOverflowing: true,
          isVisible: false,
          forceVisible: false,
          track: {},
          scrollbar: {}
        }
      };
      this.removePreventClickId = null; // Don't re-instantiate over an existing one

      if (SimpleBar.instances.has(this.el)) {
        return;
      }

      this.recalculate = lodash_throttle(this.recalculate.bind(this), 64);
      this.onMouseMove = lodash_throttle(this.onMouseMove.bind(this), 64);
      this.hideScrollbars = lodash_debounce(this.hideScrollbars.bind(this), this.options.timeout);
      this.onWindowResize = lodash_debounce(this.onWindowResize.bind(this), 64, {
        leading: true
      });
      SimpleBar.getRtlHelpers = lodash_memoize(SimpleBar.getRtlHelpers);
      this.init();
    }
    /**
     * Static properties
     */

    /**
     * Helper to fix browsers inconsistency on RTL:
     *  - Firefox inverts the scrollbar initial position
     *  - IE11 inverts both scrollbar position and scrolling offset
     * Directly inspired by @KingSora's OverlayScrollbars https://github.com/KingSora/OverlayScrollbars/blob/master/js/OverlayScrollbars.js#L1634
     */


    SimpleBar.getRtlHelpers = function getRtlHelpers() {
      var dummyDiv = document.createElement('div');
      dummyDiv.innerHTML = '<div class="hs-dummy-scrollbar-size"><div style="height: 200%; width: 200%; margin: 10px 0;"></div></div>';
      var scrollbarDummyEl = dummyDiv.firstElementChild;
      document.body.appendChild(scrollbarDummyEl);
      var dummyContainerChild = scrollbarDummyEl.firstElementChild;
      scrollbarDummyEl.scrollLeft = 0;
      var dummyContainerOffset = SimpleBar.getOffset(scrollbarDummyEl);
      var dummyContainerChildOffset = SimpleBar.getOffset(dummyContainerChild);
      scrollbarDummyEl.scrollLeft = 999;
      var dummyContainerScrollOffsetAfterScroll = SimpleBar.getOffset(dummyContainerChild);
      return {
        // determines if the scrolling is responding with negative values
        isRtlScrollingInverted: dummyContainerOffset.left !== dummyContainerChildOffset.left && dummyContainerChildOffset.left - dummyContainerScrollOffsetAfterScroll.left !== 0,
        // determines if the origin scrollbar position is inverted or not (positioned on left or right)
        isRtlScrollbarInverted: dummyContainerOffset.left !== dummyContainerChildOffset.left
      };
    };

    SimpleBar.getOffset = function getOffset(el) {
      var rect = el.getBoundingClientRect();
      var elDocument = getElementDocument(el);
      var elWindow = getElementWindow(el);
      return {
        top: rect.top + (elWindow.pageYOffset || elDocument.documentElement.scrollTop),
        left: rect.left + (elWindow.pageXOffset || elDocument.documentElement.scrollLeft)
      };
    };

    var _proto = SimpleBar.prototype;

    _proto.init = function init() {
      // Save a reference to the instance, so we know this DOM node has already been instancied
      SimpleBar.instances.set(this.el, this); // We stop here on server-side

      if (canUseDom) {
        this.initDOM();
        this.setAccessibilityAttributes();
        this.scrollbarWidth = this.getScrollbarWidth();
        this.recalculate();
        this.initListeners();
      }
    };

    _proto.initDOM = function initDOM() {
      var _this2 = this;

      // make sure this element doesn't have the elements yet
      if (Array.prototype.filter.call(this.el.children, function (child) {
        return child.classList.contains(_this2.classNames.wrapper);
      }).length) {
        // assume that element has his DOM already initiated
        this.wrapperEl = this.el.querySelector("." + this.classNames.wrapper);
        this.contentWrapperEl = this.options.scrollableNode || this.el.querySelector("." + this.classNames.contentWrapper);
        this.contentEl = this.options.contentNode || this.el.querySelector("." + this.classNames.contentEl);
        this.offsetEl = this.el.querySelector("." + this.classNames.offset);
        this.maskEl = this.el.querySelector("." + this.classNames.mask);
        this.placeholderEl = this.findChild(this.wrapperEl, "." + this.classNames.placeholder);
        this.heightAutoObserverWrapperEl = this.el.querySelector("." + this.classNames.heightAutoObserverWrapperEl);
        this.heightAutoObserverEl = this.el.querySelector("." + this.classNames.heightAutoObserverEl);
        this.axis.x.track.el = this.findChild(this.el, "." + this.classNames.track + "." + this.classNames.horizontal);
        this.axis.y.track.el = this.findChild(this.el, "." + this.classNames.track + "." + this.classNames.vertical);
      } else {
        // Prepare DOM
        this.wrapperEl = document.createElement('div');
        this.contentWrapperEl = document.createElement('div');
        this.offsetEl = document.createElement('div');
        this.maskEl = document.createElement('div');
        this.contentEl = document.createElement('div');
        this.placeholderEl = document.createElement('div');
        this.heightAutoObserverWrapperEl = document.createElement('div');
        this.heightAutoObserverEl = document.createElement('div');
        this.wrapperEl.classList.add(this.classNames.wrapper);
        this.contentWrapperEl.classList.add(this.classNames.contentWrapper);
        this.offsetEl.classList.add(this.classNames.offset);
        this.maskEl.classList.add(this.classNames.mask);
        this.contentEl.classList.add(this.classNames.contentEl);
        this.placeholderEl.classList.add(this.classNames.placeholder);
        this.heightAutoObserverWrapperEl.classList.add(this.classNames.heightAutoObserverWrapperEl);
        this.heightAutoObserverEl.classList.add(this.classNames.heightAutoObserverEl);

        while (this.el.firstChild) {
          this.contentEl.appendChild(this.el.firstChild);
        }

        this.contentWrapperEl.appendChild(this.contentEl);
        this.offsetEl.appendChild(this.contentWrapperEl);
        this.maskEl.appendChild(this.offsetEl);
        this.heightAutoObserverWrapperEl.appendChild(this.heightAutoObserverEl);
        this.wrapperEl.appendChild(this.heightAutoObserverWrapperEl);
        this.wrapperEl.appendChild(this.maskEl);
        this.wrapperEl.appendChild(this.placeholderEl);
        this.el.appendChild(this.wrapperEl);
      }

      if (!this.axis.x.track.el || !this.axis.y.track.el) {
        var track = document.createElement('div');
        var scrollbar = document.createElement('div');
        track.classList.add(this.classNames.track);
        scrollbar.classList.add(this.classNames.scrollbar);
        track.appendChild(scrollbar);
        this.axis.x.track.el = track.cloneNode(true);
        this.axis.x.track.el.classList.add(this.classNames.horizontal);
        this.axis.y.track.el = track.cloneNode(true);
        this.axis.y.track.el.classList.add(this.classNames.vertical);
        this.el.appendChild(this.axis.x.track.el);
        this.el.appendChild(this.axis.y.track.el);
      }

      this.axis.x.scrollbar.el = this.axis.x.track.el.querySelector("." + this.classNames.scrollbar);
      this.axis.y.scrollbar.el = this.axis.y.track.el.querySelector("." + this.classNames.scrollbar);

      if (!this.options.autoHide) {
        this.axis.x.scrollbar.el.classList.add(this.classNames.visible);
        this.axis.y.scrollbar.el.classList.add(this.classNames.visible);
      }

      this.el.setAttribute('data-simplebar', 'init');
    };

    _proto.setAccessibilityAttributes = function setAccessibilityAttributes() {
      var ariaLabel = this.options.ariaLabel || 'scrollable content';
      this.contentWrapperEl.setAttribute('tabindex', '0');
      this.contentWrapperEl.setAttribute('role', 'region');
      this.contentWrapperEl.setAttribute('aria-label', ariaLabel);
    };

    _proto.initListeners = function initListeners() {
      var _this3 = this;

      var elWindow = getElementWindow(this.el); // Event listeners

      if (this.options.autoHide) {
        this.el.addEventListener('mouseenter', this.onMouseEnter);
      }

      ['mousedown', 'click', 'dblclick'].forEach(function (e) {
        _this3.el.addEventListener(e, _this3.onPointerEvent, true);
      });
      ['touchstart', 'touchend', 'touchmove'].forEach(function (e) {
        _this3.el.addEventListener(e, _this3.onPointerEvent, {
          capture: true,
          passive: true
        });
      });
      this.el.addEventListener('mousemove', this.onMouseMove);
      this.el.addEventListener('mouseleave', this.onMouseLeave);
      this.contentWrapperEl.addEventListener('scroll', this.onScroll); // Browser zoom triggers a window resize

      elWindow.addEventListener('resize', this.onWindowResize); // Hack for https://github.com/WICG/ResizeObserver/issues/38

      var resizeObserverStarted = false;
      var resizeObserver = elWindow.ResizeObserver || ResizeObserver$1;
      this.resizeObserver = new resizeObserver(function () {
        if (!resizeObserverStarted) return;

        _this3.recalculate();
      });
      this.resizeObserver.observe(this.el);
      this.resizeObserver.observe(this.contentEl);
      elWindow.requestAnimationFrame(function () {
        resizeObserverStarted = true;
      }); // This is required to detect horizontal scroll. Vertical scroll only needs the resizeObserver.

      this.mutationObserver = new elWindow.MutationObserver(this.recalculate);
      this.mutationObserver.observe(this.contentEl, {
        childList: true,
        subtree: true,
        characterData: true
      });
    };

    _proto.recalculate = function recalculate() {
      var elWindow = getElementWindow(this.el);
      this.elStyles = elWindow.getComputedStyle(this.el);
      this.isRtl = this.elStyles.direction === 'rtl';
      var isHeightAuto = this.heightAutoObserverEl.offsetHeight <= 1;
      var isWidthAuto = this.heightAutoObserverEl.offsetWidth <= 1;
      var contentElOffsetWidth = this.contentEl.offsetWidth;
      var contentWrapperElOffsetWidth = this.contentWrapperEl.offsetWidth;
      var elOverflowX = this.elStyles.overflowX;
      var elOverflowY = this.elStyles.overflowY;
      this.contentEl.style.padding = this.elStyles.paddingTop + " " + this.elStyles.paddingRight + " " + this.elStyles.paddingBottom + " " + this.elStyles.paddingLeft;
      this.wrapperEl.style.margin = "-" + this.elStyles.paddingTop + " -" + this.elStyles.paddingRight + " -" + this.elStyles.paddingBottom + " -" + this.elStyles.paddingLeft;
      var contentElScrollHeight = this.contentEl.scrollHeight;
      var contentElScrollWidth = this.contentEl.scrollWidth;
      this.contentWrapperEl.style.height = isHeightAuto ? 'auto' : '100%'; // Determine placeholder size

      this.placeholderEl.style.width = isWidthAuto ? contentElOffsetWidth + "px" : 'auto';
      this.placeholderEl.style.height = contentElScrollHeight + "px";
      var contentWrapperElOffsetHeight = this.contentWrapperEl.offsetHeight;
      this.axis.x.isOverflowing = contentElScrollWidth > contentElOffsetWidth;
      this.axis.y.isOverflowing = contentElScrollHeight > contentWrapperElOffsetHeight; // Set isOverflowing to false if user explicitely set hidden overflow

      this.axis.x.isOverflowing = elOverflowX === 'hidden' ? false : this.axis.x.isOverflowing;
      this.axis.y.isOverflowing = elOverflowY === 'hidden' ? false : this.axis.y.isOverflowing;
      this.axis.x.forceVisible = this.options.forceVisible === 'x' || this.options.forceVisible === true;
      this.axis.y.forceVisible = this.options.forceVisible === 'y' || this.options.forceVisible === true;
      this.hideNativeScrollbar(); // Set isOverflowing to false if scrollbar is not necessary (content is shorter than offset)

      var offsetForXScrollbar = this.axis.x.isOverflowing ? this.scrollbarWidth : 0;
      var offsetForYScrollbar = this.axis.y.isOverflowing ? this.scrollbarWidth : 0;
      this.axis.x.isOverflowing = this.axis.x.isOverflowing && contentElScrollWidth > contentWrapperElOffsetWidth - offsetForYScrollbar;
      this.axis.y.isOverflowing = this.axis.y.isOverflowing && contentElScrollHeight > contentWrapperElOffsetHeight - offsetForXScrollbar;
      this.axis.x.scrollbar.size = this.getScrollbarSize('x');
      this.axis.y.scrollbar.size = this.getScrollbarSize('y');
      this.axis.x.scrollbar.el.style.width = this.axis.x.scrollbar.size + "px";
      this.axis.y.scrollbar.el.style.height = this.axis.y.scrollbar.size + "px";
      this.positionScrollbar('x');
      this.positionScrollbar('y');
      this.toggleTrackVisibility('x');
      this.toggleTrackVisibility('y');
    }
    /**
     * Calculate scrollbar size
     */
    ;

    _proto.getScrollbarSize = function getScrollbarSize(axis) {
      if (axis === void 0) {
        axis = 'y';
      }

      if (!this.axis[axis].isOverflowing) {
        return 0;
      }

      var contentSize = this.contentEl[this.axis[axis].scrollSizeAttr];
      var trackSize = this.axis[axis].track.el[this.axis[axis].offsetSizeAttr];
      var scrollbarSize;
      var scrollbarRatio = trackSize / contentSize; // Calculate new height/position of drag handle.

      scrollbarSize = Math.max(~~(scrollbarRatio * trackSize), this.options.scrollbarMinSize);

      if (this.options.scrollbarMaxSize) {
        scrollbarSize = Math.min(scrollbarSize, this.options.scrollbarMaxSize);
      }

      return scrollbarSize;
    };

    _proto.positionScrollbar = function positionScrollbar(axis) {
      if (axis === void 0) {
        axis = 'y';
      }

      if (!this.axis[axis].isOverflowing) {
        return;
      }

      var contentSize = this.contentWrapperEl[this.axis[axis].scrollSizeAttr];
      var trackSize = this.axis[axis].track.el[this.axis[axis].offsetSizeAttr];
      var hostSize = parseInt(this.elStyles[this.axis[axis].sizeAttr], 10);
      var scrollbar = this.axis[axis].scrollbar;
      var scrollOffset = this.contentWrapperEl[this.axis[axis].scrollOffsetAttr];
      scrollOffset = axis === 'x' && this.isRtl && SimpleBar.getRtlHelpers().isRtlScrollingInverted ? -scrollOffset : scrollOffset;
      var scrollPourcent = scrollOffset / (contentSize - hostSize);
      var handleOffset = ~~((trackSize - scrollbar.size) * scrollPourcent);
      handleOffset = axis === 'x' && this.isRtl && SimpleBar.getRtlHelpers().isRtlScrollbarInverted ? handleOffset + (trackSize - scrollbar.size) : handleOffset;
      scrollbar.el.style.transform = axis === 'x' ? "translate3d(" + handleOffset + "px, 0, 0)" : "translate3d(0, " + handleOffset + "px, 0)";
    };

    _proto.toggleTrackVisibility = function toggleTrackVisibility(axis) {
      if (axis === void 0) {
        axis = 'y';
      }

      var track = this.axis[axis].track.el;
      var scrollbar = this.axis[axis].scrollbar.el;

      if (this.axis[axis].isOverflowing || this.axis[axis].forceVisible) {
        track.style.visibility = 'visible';
        this.contentWrapperEl.style[this.axis[axis].overflowAttr] = 'scroll';
      } else {
        track.style.visibility = 'hidden';
        this.contentWrapperEl.style[this.axis[axis].overflowAttr] = 'hidden';
      } // Even if forceVisible is enabled, scrollbar itself should be hidden


      if (this.axis[axis].isOverflowing) {
        scrollbar.style.display = 'block';
      } else {
        scrollbar.style.display = 'none';
      }
    };

    _proto.hideNativeScrollbar = function hideNativeScrollbar() {
      this.offsetEl.style[this.isRtl ? 'left' : 'right'] = this.axis.y.isOverflowing || this.axis.y.forceVisible ? "-" + this.scrollbarWidth + "px" : 0;
      this.offsetEl.style.bottom = this.axis.x.isOverflowing || this.axis.x.forceVisible ? "-" + this.scrollbarWidth + "px" : 0;
    }
    /**
     * On scroll event handling
     */
    ;

    _proto.onMouseMoveForAxis = function onMouseMoveForAxis(axis) {
      if (axis === void 0) {
        axis = 'y';
      }

      this.axis[axis].track.rect = this.axis[axis].track.el.getBoundingClientRect();
      this.axis[axis].scrollbar.rect = this.axis[axis].scrollbar.el.getBoundingClientRect();
      var isWithinScrollbarBoundsX = this.isWithinBounds(this.axis[axis].scrollbar.rect);

      if (isWithinScrollbarBoundsX) {
        this.axis[axis].scrollbar.el.classList.add(this.classNames.hover);
      } else {
        this.axis[axis].scrollbar.el.classList.remove(this.classNames.hover);
      }

      if (this.isWithinBounds(this.axis[axis].track.rect)) {
        this.showScrollbar(axis);
        this.axis[axis].track.el.classList.add(this.classNames.hover);
      } else {
        this.axis[axis].track.el.classList.remove(this.classNames.hover);
      }
    };

    _proto.onMouseLeaveForAxis = function onMouseLeaveForAxis(axis) {
      if (axis === void 0) {
        axis = 'y';
      }

      this.axis[axis].track.el.classList.remove(this.classNames.hover);
      this.axis[axis].scrollbar.el.classList.remove(this.classNames.hover);
    };

    /**
     * Show scrollbar
     */
    _proto.showScrollbar = function showScrollbar(axis) {
      if (axis === void 0) {
        axis = 'y';
      }

      var scrollbar = this.axis[axis].scrollbar.el;

      if (!this.axis[axis].isVisible) {
        scrollbar.classList.add(this.classNames.visible);
        this.axis[axis].isVisible = true;
      }

      if (this.options.autoHide) {
        this.hideScrollbars();
      }
    }
    /**
     * Hide Scrollbar
     */
    ;

    /**
     * on scrollbar handle drag movement starts
     */
    _proto.onDragStart = function onDragStart(e, axis) {
      if (axis === void 0) {
        axis = 'y';
      }

      var elDocument = getElementDocument(this.el);
      var elWindow = getElementWindow(this.el);
      var scrollbar = this.axis[axis].scrollbar; // Measure how far the user's mouse is from the top of the scrollbar drag handle.

      var eventOffset = axis === 'y' ? e.pageY : e.pageX;
      this.axis[axis].dragOffset = eventOffset - scrollbar.rect[this.axis[axis].offsetAttr];
      this.draggedAxis = axis;
      this.el.classList.add(this.classNames.dragging);
      elDocument.addEventListener('mousemove', this.drag, true);
      elDocument.addEventListener('mouseup', this.onEndDrag, true);

      if (this.removePreventClickId === null) {
        elDocument.addEventListener('click', this.preventClick, true);
        elDocument.addEventListener('dblclick', this.preventClick, true);
      } else {
        elWindow.clearTimeout(this.removePreventClickId);
        this.removePreventClickId = null;
      }
    }
    /**
     * Drag scrollbar handle
     */
    ;

    _proto.onTrackClick = function onTrackClick(e, axis) {
      var _this4 = this;

      if (axis === void 0) {
        axis = 'y';
      }

      if (!this.options.clickOnTrack) return;
      var elWindow = getElementWindow(this.el);
      this.axis[axis].scrollbar.rect = this.axis[axis].scrollbar.el.getBoundingClientRect();
      var scrollbar = this.axis[axis].scrollbar;
      var scrollbarOffset = scrollbar.rect[this.axis[axis].offsetAttr];
      var hostSize = parseInt(this.elStyles[this.axis[axis].sizeAttr], 10);
      var scrolled = this.contentWrapperEl[this.axis[axis].scrollOffsetAttr];
      var t = axis === 'y' ? this.mouseY - scrollbarOffset : this.mouseX - scrollbarOffset;
      var dir = t < 0 ? -1 : 1;
      var scrollSize = dir === -1 ? scrolled - hostSize : scrolled + hostSize;

      var scrollTo = function scrollTo() {
        if (dir === -1) {
          if (scrolled > scrollSize) {
            var _this4$contentWrapper;

            scrolled -= _this4.options.clickOnTrackSpeed;

            _this4.contentWrapperEl.scrollTo((_this4$contentWrapper = {}, _this4$contentWrapper[_this4.axis[axis].offsetAttr] = scrolled, _this4$contentWrapper));

            elWindow.requestAnimationFrame(scrollTo);
          }
        } else {
          if (scrolled < scrollSize) {
            var _this4$contentWrapper2;

            scrolled += _this4.options.clickOnTrackSpeed;

            _this4.contentWrapperEl.scrollTo((_this4$contentWrapper2 = {}, _this4$contentWrapper2[_this4.axis[axis].offsetAttr] = scrolled, _this4$contentWrapper2));

            elWindow.requestAnimationFrame(scrollTo);
          }
        }
      };

      scrollTo();
    }
    /**
     * Getter for content element
     */
    ;

    _proto.getContentElement = function getContentElement() {
      return this.contentEl;
    }
    /**
     * Getter for original scrolling element
     */
    ;

    _proto.getScrollElement = function getScrollElement() {
      return this.contentWrapperEl;
    };

    _proto.getScrollbarWidth = function getScrollbarWidth() {
      // Try/catch for FF 56 throwing on undefined computedStyles
      try {
        // Detect browsers supporting CSS scrollbar styling and do not calculate
        if (getComputedStyle(this.contentWrapperEl, '::-webkit-scrollbar').display === 'none' || 'scrollbarWidth' in document.documentElement.style || '-ms-overflow-style' in document.documentElement.style) {
          return 0;
        } else {
          return scrollbarWidth(this.el);
        }
      } catch (e) {
        return scrollbarWidth(this.el);
      }
    };

    _proto.removeListeners = function removeListeners() {
      var _this5 = this;

      var elWindow = getElementWindow(this.el); // Event listeners

      if (this.options.autoHide) {
        this.el.removeEventListener('mouseenter', this.onMouseEnter);
      }

      ['mousedown', 'click', 'dblclick'].forEach(function (e) {
        _this5.el.removeEventListener(e, _this5.onPointerEvent, true);
      });
      ['touchstart', 'touchend', 'touchmove'].forEach(function (e) {
        _this5.el.removeEventListener(e, _this5.onPointerEvent, {
          capture: true,
          passive: true
        });
      });
      this.el.removeEventListener('mousemove', this.onMouseMove);
      this.el.removeEventListener('mouseleave', this.onMouseLeave);

      if (this.contentWrapperEl) {
        this.contentWrapperEl.removeEventListener('scroll', this.onScroll);
      }

      elWindow.removeEventListener('resize', this.onWindowResize);

      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
      }

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      } // Cancel all debounced functions


      this.recalculate.cancel();
      this.onMouseMove.cancel();
      this.hideScrollbars.cancel();
      this.onWindowResize.cancel();
    }
    /**
     * UnMount mutation observer and delete SimpleBar instance from DOM element
     */
    ;

    _proto.unMount = function unMount() {
      this.removeListeners();
      SimpleBar.instances.delete(this.el);
    }
    /**
     * Check if mouse is within bounds
     */
    ;

    _proto.isWithinBounds = function isWithinBounds(bbox) {
      return this.mouseX >= bbox.left && this.mouseX <= bbox.left + bbox.width && this.mouseY >= bbox.top && this.mouseY <= bbox.top + bbox.height;
    }
    /**
     * Find element children matches query
     */
    ;

    _proto.findChild = function findChild(el, query) {
      var matches = el.matches || el.webkitMatchesSelector || el.mozMatchesSelector || el.msMatchesSelector;
      return Array.prototype.filter.call(el.children, function (child) {
        return matches.call(child, query);
      })[0];
    };

    return SimpleBar;
  }();

  SimpleBar.defaultOptions = {
    autoHide: true,
    forceVisible: false,
    clickOnTrack: true,
    clickOnTrackSpeed: 40,
    classNames: {
      contentEl: 'simplebar-content',
      contentWrapper: 'simplebar-content-wrapper',
      offset: 'simplebar-offset',
      mask: 'simplebar-mask',
      wrapper: 'simplebar-wrapper',
      placeholder: 'simplebar-placeholder',
      scrollbar: 'simplebar-scrollbar',
      track: 'simplebar-track',
      heightAutoObserverWrapperEl: 'simplebar-height-auto-observer-wrapper',
      heightAutoObserverEl: 'simplebar-height-auto-observer',
      visible: 'simplebar-visible',
      horizontal: 'simplebar-horizontal',
      vertical: 'simplebar-vertical',
      hover: 'simplebar-hover',
      dragging: 'simplebar-dragging'
    },
    scrollbarMinSize: 25,
    scrollbarMaxSize: 0,
    timeout: 1000
  };
  SimpleBar.instances = new WeakMap();

  SimpleBar.initDOMLoadedElements = function () {
    document.removeEventListener('DOMContentLoaded', this.initDOMLoadedElements);
    window.removeEventListener('load', this.initDOMLoadedElements);
    Array.prototype.forEach.call(document.querySelectorAll('[data-simplebar]'), function (el) {
      if (el.getAttribute('data-simplebar') !== 'init' && !SimpleBar.instances.has(el)) new SimpleBar(el, getOptions(el.attributes));
    });
  };

  SimpleBar.removeObserver = function () {
    this.globalObserver.disconnect();
  };

  SimpleBar.initHtmlApi = function () {
    this.initDOMLoadedElements = this.initDOMLoadedElements.bind(this); // MutationObserver is IE11+

    if (typeof MutationObserver !== 'undefined') {
      // Mutation observer to observe dynamically added elements
      this.globalObserver = new MutationObserver(SimpleBar.handleMutations);
      this.globalObserver.observe(document, {
        childList: true,
        subtree: true
      });
    } // Taken from jQuery `ready` function
    // Instantiate elements already present on the page


    if (document.readyState === 'complete' || document.readyState !== 'loading' && !document.documentElement.doScroll) {
      // Handle it asynchronously to allow scripts the opportunity to delay init
      window.setTimeout(this.initDOMLoadedElements);
    } else {
      document.addEventListener('DOMContentLoaded', this.initDOMLoadedElements);
      window.addEventListener('load', this.initDOMLoadedElements);
    }
  };

  SimpleBar.handleMutations = function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes, function (addedNode) {
        if (addedNode.nodeType === 1) {
          if (addedNode.hasAttribute('data-simplebar')) {
            !SimpleBar.instances.has(addedNode) && document.documentElement.contains(addedNode) && new SimpleBar(addedNode, getOptions(addedNode.attributes));
          } else {
            Array.prototype.forEach.call(addedNode.querySelectorAll('[data-simplebar]'), function (el) {
              if (el.getAttribute('data-simplebar') !== 'init' && !SimpleBar.instances.has(el) && document.documentElement.contains(el)) new SimpleBar(el, getOptions(el.attributes));
            });
          }
        }
      });
      Array.prototype.forEach.call(mutation.removedNodes, function (removedNode) {
        if (removedNode.nodeType === 1) {
          if (removedNode.getAttribute('data-simplebar') === 'init') {
            SimpleBar.instances.has(removedNode) && !document.documentElement.contains(removedNode) && SimpleBar.instances.get(removedNode).unMount();
          } else {
            Array.prototype.forEach.call(removedNode.querySelectorAll('[data-simplebar="init"]'), function (el) {
              SimpleBar.instances.has(el) && !document.documentElement.contains(el) && SimpleBar.instances.get(el).unMount();
            });
          }
        }
      });
    });
  };

  SimpleBar.getOptions = getOptions;
  /**
   * HTML API
   * Called only in a browser env.
   */

  if (canUseDom) {
    SimpleBar.initHtmlApi();
  }
  //# sourceMappingURL=simplebar.esm.js.map

  class Modal {
  	constructor(el) {
  		this.el = el;
  		this.needOverlay = !el.dataset.modalNoOverlay;
  		this.parentModal = el.dataset.parentModal;
  		this.clickedToggle = null;
  		this.firstInput = this.el.querySelector('input, textarea');
  	}
  	get isActive() {
  		return this.el.classList.contains('is-active')
  	}
  	set isActive(bool) {
  		if (bool) {
  			this.el.classList.add('is-active');
  			if (this.firstInput) {
  				setTimeout(() =>  {
  					this.firstInput.focus();
  				}, 100);
  			}
  		}
  		else  {
  			this.el.classList.remove('is-active');
  			if (this.clickedToggle) {
  				this.clickedToggle.classList.remove('is-clicked');
  			}
  			if (this.el.querySelector('.on-success')) {
  				setTimeout(_ => {
  					this.el.querySelector('.on-success').classList.remove('on-success');
  				}, 500);
  			}
  		}
  	}
  	get isOnActiveChild() {
  		return this.el.classList.contains('on-active-child')
  	}
  	set isOnActiveChild(bool) {
  		if (bool) {
  			this.el.classList.add('on-active-child');
  		}
  		else  {
  			this.el.classList.remove('on-active-child');
  		}
  	}
  }

  let ModalDispatcher = (function () {

  	let commonModalOverlay,
  	commonModalOverlayRect,
  	commonCloseButton,
  	prevAddClass,
  	activeModal =  null,
  	modalsContainer = document.querySelector('.modals'),
  	modalsList = {};

  	setTimeout( _ => {
  		modalsContainer.style.opacity = "";
  	}, 1000); 

  	function checkIfModalInList(modalName) {
  		return (typeof modalsList[modalName] !== 'undefined')
  	}

  	function createModal(modal) {
  		let modalName = modal.dataset.modal;
  		if (!checkIfModalInList(modalName)) {
  			modalsList[modalName] = new Modal(modal);
  		}


  	}

  	function fillList() {
  		modalsList = {};
  		let modals = document.querySelectorAll('[data-modal]');
  		[].forEach.call(modals, createModal);
  	}


  	function showModal(modal) {

  		if (activeModal) {
  			if (activeModal === modalsList[modal.parentModal]) {
  				modalsList[modal.parentModal].isOnActiveChild = true;
  			}
  			else {
  				
  				if (activeModal.parentModal && modalsList[activeModal.parentModal].isActive) {
  					closeModal(modalsList[activeModal.parentModal]);
  				}
  				closeModal();
  				
  			}
  		}

  		if (modal.el.dataset.addBodyClass) {
  			document.body.classList.add(modal.el.dataset.addBodyClass);
  		}

  		if (prevAddClass && !modal.el.hasAttribute('data-add-body-class') || 
  			(modal.el.hasAttribute('data-add-body-class') && prevAddClass !== modal.el.dataset.addBodyClass)) {
  				
  			document.body.classList.remove(prevAddClass);
  		}

  		if (modal.el.dataset.addBodyClass) {
  			prevAddClass = modal.el.dataset.addBodyClass;
  		}

  		modal.isActive = true;
  		activeModal = modal;
  		handleOverlay();
  	}

  	function closeModal(modal) {

  		if (activeModal.parentModal) {
  			modalsList[activeModal.parentModal].isOnActiveChild = false;
  			activeModal.isActive = false;
  			activeModal = modalsList[activeModal.parentModal];
  		}
  		else { 
  			closeAll();
  		}


  		handleOverlay();
  	}

  	function handleClosing(modal = null) {
  		if (modal) {
  			closeModal();
  		}
  		else {
  			closeAll();
  		}
  	}

  	function closeAll(event) {
  		if (!event || event.which === 1) {
  			if (activeModal) {
  				activeModal.isActive = false;
  				if (modalsList[activeModal.parentModal]) {
  					modalsList[activeModal.parentModal].isActive = false;
  					modalsList[activeModal.parentModal].isOnActiveChild = false;
  				}

  				// console.log(activeModal);

  				if (activeModal.el.querySelector('video')) {
  					activeModal.el.querySelector('video').pause();
  				}

  				
  				if (activeModal.el.dataset.addBodyClass) {
  					const activeModalClass = activeModal.el.dataset.addBodyClass;

  					// document.body.classList.remove(activeModalClass);

  					setTimeout( _ => {
  						if (activeModal && activeModal.el.dataset.addBodyClass !== activeModalClass) {
  							document.body.classList.remove(activeModalClass);
  						} else if (!activeModal) {
  							document.body.classList.remove(activeModalClass);
  						}
  					}, 500);
  				}

  				// document.dispatchEvent(new CustomEvent('needModal', {detail: activeModal}));  

  				activeModal = null;
  				handleOverlay();
  			}

  		}


  	}

  	function handleOverlay() {
  		if (!commonModalOverlay) {
  			return 
  		}


  		if (activeModal && activeModal.needOverlay) {
  			commonModalOverlay.classList.add('is-active');
  			document.querySelector('html').style.overflowY = 'hidden';
  			document.querySelector('html').style.touchAction = 'none';
  			// document.querySelector('html').style.paddingRight = `${getScrollWidth()}px`;
  			if (commonCloseButton) {
  				commonCloseButton.style.willChange = 'transform';
  			}
  		}
  		else {
  			commonModalOverlay.classList.remove('is-active');
  			document.querySelector('html').style.overflowY = 'unset';
  			document.querySelector('html').style.touchAction = '';
  			// document.querySelector('html').style.paddingRight = "";
  			if (commonCloseButton) {
  				commonCloseButton.style.willChange = '';
  			}
  		}
  	}

  	function moveCloseButton(event) {
  		let x = event.pageX,
  		y = event.pageY,
  		modalOffsetX = commonModalOverlayRect.left,
  		modalOffsetY = commonModalOverlayRect.top,
  		toX = x - modalOffsetX - commonCloseButton.offsetWidth / 2,
  		toY = y - modalOffsetY - commonCloseButton.offsetHeight / 2;

  		commonCloseButton.style.transform =
  		'translate3d(' + toX + 'px, ' + toY + 'px, 0)';
  	}

  	function hideCloseButton() {
  		commonCloseButton.style.display = 'none';
  	}
  	function showCloseButton() {
  		commonCloseButton.style.display = '';
  	}

  	function setInputs(modal, inputs) {
  		const target = modal.el.querySelector('form') ? modal.el.querySelector('form') : modal.el.closest('form');
  		inputs.forEach(input => {
  			console.log(modal.el);
  			const el = target.querySelector(`[name="${input.key}"]`);
  			if (el) {
  				el.value = input.value;
  			}
  		});
  	}
  	function setFormId(modal, formId) {
  		const target = modal.el.querySelector('form');
  		target.dataset.formId = formId;
  	}

  	function bindEvents() {
  		document.addEventListener('click', function (event) {
  			console.log('test');
  			if (event.which === 1) {
  				let toggle = event.target.closest('[data-linked-modal]');
  				if (!!toggle && !!modalsList[toggle.dataset.linkedModal]) {
  					toggle.classList.add('is-clicked');
  					modalsList[toggle.dataset.linkedModal].clickedToggle = toggle;
  					showModal(modalsList[toggle.dataset.linkedModal]);
  					event.stopPropagation();
  					event.preventDefault();

  					if (toggle.dataset.modalSetInputs) {
  						setInputs(modalsList[toggle.dataset.linkedModal], JSON.parse(toggle.dataset.modalSetInputs));
  					}
  					if (toggle.dataset.modalFormId) {
  						setFormId(modalsList[toggle.dataset.linkedModal], toggle.dataset.modalFormId);
  					}
  				}

  			}
  		});

  		document.addEventListener('mousedown', function (event) {
  			if (event.which === 1) {
  				let closeButton = event.target.closest('[data-modal-close]');
  				if (!!closeButton) {
  					var modal = modalsList[closeButton.closest('[data-modal]').dataset.modal];
  					handleClosing(modal);
  				}
  			}
  		});
  		document.addEventListener('keyup', function (event) {
  			event = event || window.event;
  			if (event.keyCode == 27) {
  				handleClosing(activeModal);
  			}
  		});

  		document.addEventListener('needModal', ({detail}) => {	
  			showModal(modalsList[detail]);
  		});

  		document.addEventListener('needCloseModal', ({detail}) => {
  			closeModal(modalsList[detail]);
  		});

  		if (commonModalOverlay) {
  			commonModalOverlay.addEventListener('mousedown', closeAll);
  			if (commonCloseButton) {
  				commonModalOverlayRect = commonModalOverlay.getBoundingClientRect();
  				commonModalOverlay.addEventListener('mousemove', Utils.throttle(moveCloseButton, 10));
  				commonModalOverlay.addEventListener('mouseleave', hideCloseButton);
  				commonModalOverlay.addEventListener('mouseenter', showCloseButton);
  			}
  		}
  	}

  	function init() {
  		commonModalOverlay = document.getElementById('commonModalOverlay');
  		commonCloseButton = document.getElementById('commonCloseButton');
  		fillList();
  		bindEvents();

  	}
  	return {
  		init: init,
  		closeAll: closeAll    
  	}

  })();

  function formSubmit() {
      
      window.dataLayer = window.dataLayer || [];


      document.addEventListener('submit', function(event) {
          
          if (event.target.closest('[data-mailer]')) {
              event.preventDefault();
              event.stopPropagation();
              let form = event.target.closest('form');
              let data = new FormData(form);
              const utm = sessionStorage.utm ? JSON.parse(sessionStorage.utm) : {};
      		Object.keys(utm).forEach(key => {
      			data.append(`utm_${key}`, utm[key]);
      		});
      		
      		if (data.get('phone') && data.get('phone') === '+7 (___) ___-__-__') {
                  return;
              }
              
      		
      		data.append(`page_href`, window.location.href);
      		data.append('referrer', document.referrer);
              data.append('date', new Date().toLocaleString());
              
              // data = appendFormData(form, data);
              form.classList.add("on-request");
              
              fetch("/mailer.php", {
                  method: 'POST',
                  body: data
              }).then(function(r) {

                  return r.text();

              }).then(function () {
                  window.dataLayer.push({
                      event: 'formSubmission',
                      data: {
  	                    formId: form.dataset.formId,
  	                }
                  });
                  window.dataLayer.push({
                          formId: form.dataset.formId,
                  });
                  
                  if (event.target.closest('[data-presentation]')) {
                      const presentationData = JSON.parse(event.target.closest('[data-presentation]').dataset.presentation);

                      var link = document.createElement('a');
                      link.setAttribute('href', presentationData.href);
                      //link.setAttribute('target', '_blank');
                      link.download = presentationData.name;
                      link.click();
                      // document.dispatchEvent(new CustomEvent('needModal', {detail: 'presentation_success'}));
                  } else {
                      if (!(form.dataset.feedbackOff && form.dataset.feedbackOff === "true")) {
                          document.dispatchEvent(new CustomEvent('needModal', {detail: 'modal_success'}));                        
                      }
                  }
                  
                  form.classList.remove("on-request");
              });
          }
      });
  }

  function activeLink () {

      const activeLinks = document.querySelectorAll('[data-active-link]');

      activeLinks.forEach(el => {
          if (el.href === location.href) {
              el.classList.add('is-active');
          } else {
              el.classList.remove('is-active');
          }
      });
  }

  /**
   * SSR Window 4.0.2
   * Better handling for window object in SSR environment
   * https://github.com/nolimits4web/ssr-window
   *
   * Copyright 2021, Vladimir Kharlampidi
   *
   * Licensed under MIT
   *
   * Released on: December 13, 2021
   */
  /* eslint-disable no-param-reassign */
  function isObject$4(obj) {
      return (obj !== null &&
          typeof obj === 'object' &&
          'constructor' in obj &&
          obj.constructor === Object);
  }
  function extend(target = {}, src = {}) {
      Object.keys(src).forEach((key) => {
          if (typeof target[key] === 'undefined')
              target[key] = src[key];
          else if (isObject$4(src[key]) &&
              isObject$4(target[key]) &&
              Object.keys(src[key]).length > 0) {
              extend(target[key], src[key]);
          }
      });
  }

  const ssrDocument = {
      body: {},
      addEventListener() { },
      removeEventListener() { },
      activeElement: {
          blur() { },
          nodeName: '',
      },
      querySelector() {
          return null;
      },
      querySelectorAll() {
          return [];
      },
      getElementById() {
          return null;
      },
      createEvent() {
          return {
              initEvent() { },
          };
      },
      createElement() {
          return {
              children: [],
              childNodes: [],
              style: {},
              setAttribute() { },
              getElementsByTagName() {
                  return [];
              },
          };
      },
      createElementNS() {
          return {};
      },
      importNode() {
          return null;
      },
      location: {
          hash: '',
          host: '',
          hostname: '',
          href: '',
          origin: '',
          pathname: '',
          protocol: '',
          search: '',
      },
  };
  function getDocument() {
      const doc = typeof document !== 'undefined' ? document : {};
      extend(doc, ssrDocument);
      return doc;
  }

  const ssrWindow = {
      document: ssrDocument,
      navigator: {
          userAgent: '',
      },
      location: {
          hash: '',
          host: '',
          hostname: '',
          href: '',
          origin: '',
          pathname: '',
          protocol: '',
          search: '',
      },
      history: {
          replaceState() { },
          pushState() { },
          go() { },
          back() { },
      },
      CustomEvent: function CustomEvent() {
          return this;
      },
      addEventListener() { },
      removeEventListener() { },
      getComputedStyle() {
          return {
              getPropertyValue() {
                  return '';
              },
          };
      },
      Image() { },
      Date() { },
      screen: {},
      setTimeout() { },
      clearTimeout() { },
      matchMedia() {
          return {};
      },
      requestAnimationFrame(callback) {
          if (typeof setTimeout === 'undefined') {
              callback();
              return null;
          }
          return setTimeout(callback, 0);
      },
      cancelAnimationFrame(id) {
          if (typeof setTimeout === 'undefined') {
              return;
          }
          clearTimeout(id);
      },
  };
  function getWindow() {
      const win = typeof window !== 'undefined' ? window : {};
      extend(win, ssrWindow);
      return win;
  }

  /**
   * Dom7 4.0.6
   * Minimalistic JavaScript library for DOM manipulation, with a jQuery-compatible API
   * https://framework7.io/docs/dom7.html
   *
   * Copyright 2023, Vladimir Kharlampidi
   *
   * Licensed under MIT
   *
   * Released on: February 2, 2023
   */

  /* eslint-disable no-proto */
  function makeReactive(obj) {
    const proto = obj.__proto__;
    Object.defineProperty(obj, '__proto__', {
      get() {
        return proto;
      },

      set(value) {
        proto.__proto__ = value;
      }

    });
  }

  class Dom7 extends Array {
    constructor(items) {
      if (typeof items === 'number') {
        super(items);
      } else {
        super(...(items || []));
        makeReactive(this);
      }
    }

  }

  function arrayFlat(arr = []) {
    const res = [];
    arr.forEach(el => {
      if (Array.isArray(el)) {
        res.push(...arrayFlat(el));
      } else {
        res.push(el);
      }
    });
    return res;
  }
  function arrayFilter(arr, callback) {
    return Array.prototype.filter.call(arr, callback);
  }
  function arrayUnique(arr) {
    const uniqueArray = [];

    for (let i = 0; i < arr.length; i += 1) {
      if (uniqueArray.indexOf(arr[i]) === -1) uniqueArray.push(arr[i]);
    }

    return uniqueArray;
  }

  // eslint-disable-next-line

  function qsa(selector, context) {
    if (typeof selector !== 'string') {
      return [selector];
    }

    const a = [];
    const res = context.querySelectorAll(selector);

    for (let i = 0; i < res.length; i += 1) {
      a.push(res[i]);
    }

    return a;
  }

  function $(selector, context) {
    const window = getWindow();
    const document = getDocument();
    let arr = [];

    if (!context && selector instanceof Dom7) {
      return selector;
    }

    if (!selector) {
      return new Dom7(arr);
    }

    if (typeof selector === 'string') {
      const html = selector.trim();

      if (html.indexOf('<') >= 0 && html.indexOf('>') >= 0) {
        let toCreate = 'div';
        if (html.indexOf('<li') === 0) toCreate = 'ul';
        if (html.indexOf('<tr') === 0) toCreate = 'tbody';
        if (html.indexOf('<td') === 0 || html.indexOf('<th') === 0) toCreate = 'tr';
        if (html.indexOf('<tbody') === 0) toCreate = 'table';
        if (html.indexOf('<option') === 0) toCreate = 'select';
        const tempParent = document.createElement(toCreate);
        tempParent.innerHTML = html;

        for (let i = 0; i < tempParent.childNodes.length; i += 1) {
          arr.push(tempParent.childNodes[i]);
        }
      } else {
        arr = qsa(selector.trim(), context || document);
      } // arr = qsa(selector, document);

    } else if (selector.nodeType || selector === window || selector === document) {
      arr.push(selector);
    } else if (Array.isArray(selector)) {
      if (selector instanceof Dom7) return selector;
      arr = selector;
    }

    return new Dom7(arrayUnique(arr));
  }

  $.fn = Dom7.prototype;

  // eslint-disable-next-line

  function addClass$1(...classes) {
    const classNames = arrayFlat(classes.map(c => c.split(' ')));
    this.forEach(el => {
      el.classList.add(...classNames);
    });
    return this;
  }

  function removeClass$1(...classes) {
    const classNames = arrayFlat(classes.map(c => c.split(' ')));
    this.forEach(el => {
      el.classList.remove(...classNames);
    });
    return this;
  }

  function toggleClass(...classes) {
    const classNames = arrayFlat(classes.map(c => c.split(' ')));
    this.forEach(el => {
      classNames.forEach(className => {
        el.classList.toggle(className);
      });
    });
  }

  function hasClass(...classes) {
    const classNames = arrayFlat(classes.map(c => c.split(' ')));
    return arrayFilter(this, el => {
      return classNames.filter(className => el.classList.contains(className)).length > 0;
    }).length > 0;
  }

  function attr(attrs, value) {
    if (arguments.length === 1 && typeof attrs === 'string') {
      // Get attr
      if (this[0]) return this[0].getAttribute(attrs);
      return undefined;
    } // Set attrs


    for (let i = 0; i < this.length; i += 1) {
      if (arguments.length === 2) {
        // String
        this[i].setAttribute(attrs, value);
      } else {
        // Object
        for (const attrName in attrs) {
          this[i][attrName] = attrs[attrName];
          this[i].setAttribute(attrName, attrs[attrName]);
        }
      }
    }

    return this;
  }

  function removeAttr(attr) {
    for (let i = 0; i < this.length; i += 1) {
      this[i].removeAttribute(attr);
    }

    return this;
  }

  function transform(transform) {
    for (let i = 0; i < this.length; i += 1) {
      this[i].style.transform = transform;
    }

    return this;
  }

  function transition(duration) {
    for (let i = 0; i < this.length; i += 1) {
      this[i].style.transitionDuration = typeof duration !== 'string' ? `${duration}ms` : duration;
    }

    return this;
  }

  function on(...args) {
    let [eventType, targetSelector, listener, capture] = args;

    if (typeof args[1] === 'function') {
      [eventType, listener, capture] = args;
      targetSelector = undefined;
    }

    if (!capture) capture = false;

    function handleLiveEvent(e) {
      const target = e.target;
      if (!target) return;
      const eventData = e.target.dom7EventData || [];

      if (eventData.indexOf(e) < 0) {
        eventData.unshift(e);
      }

      if ($(target).is(targetSelector)) listener.apply(target, eventData);else {
        const parents = $(target).parents(); // eslint-disable-line

        for (let k = 0; k < parents.length; k += 1) {
          if ($(parents[k]).is(targetSelector)) listener.apply(parents[k], eventData);
        }
      }
    }

    function handleEvent(e) {
      const eventData = e && e.target ? e.target.dom7EventData || [] : [];

      if (eventData.indexOf(e) < 0) {
        eventData.unshift(e);
      }

      listener.apply(this, eventData);
    }

    const events = eventType.split(' ');
    let j;

    for (let i = 0; i < this.length; i += 1) {
      const el = this[i];

      if (!targetSelector) {
        for (j = 0; j < events.length; j += 1) {
          const event = events[j];
          if (!el.dom7Listeners) el.dom7Listeners = {};
          if (!el.dom7Listeners[event]) el.dom7Listeners[event] = [];
          el.dom7Listeners[event].push({
            listener,
            proxyListener: handleEvent
          });
          el.addEventListener(event, handleEvent, capture);
        }
      } else {
        // Live events
        for (j = 0; j < events.length; j += 1) {
          const event = events[j];
          if (!el.dom7LiveListeners) el.dom7LiveListeners = {};
          if (!el.dom7LiveListeners[event]) el.dom7LiveListeners[event] = [];
          el.dom7LiveListeners[event].push({
            listener,
            proxyListener: handleLiveEvent
          });
          el.addEventListener(event, handleLiveEvent, capture);
        }
      }
    }

    return this;
  }

  function off(...args) {
    let [eventType, targetSelector, listener, capture] = args;

    if (typeof args[1] === 'function') {
      [eventType, listener, capture] = args;
      targetSelector = undefined;
    }

    if (!capture) capture = false;
    const events = eventType.split(' ');

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];

      for (let j = 0; j < this.length; j += 1) {
        const el = this[j];
        let handlers;

        if (!targetSelector && el.dom7Listeners) {
          handlers = el.dom7Listeners[event];
        } else if (targetSelector && el.dom7LiveListeners) {
          handlers = el.dom7LiveListeners[event];
        }

        if (handlers && handlers.length) {
          for (let k = handlers.length - 1; k >= 0; k -= 1) {
            const handler = handlers[k];

            if (listener && handler.listener === listener) {
              el.removeEventListener(event, handler.proxyListener, capture);
              handlers.splice(k, 1);
            } else if (listener && handler.listener && handler.listener.dom7proxy && handler.listener.dom7proxy === listener) {
              el.removeEventListener(event, handler.proxyListener, capture);
              handlers.splice(k, 1);
            } else if (!listener) {
              el.removeEventListener(event, handler.proxyListener, capture);
              handlers.splice(k, 1);
            }
          }
        }
      }
    }

    return this;
  }

  function trigger$1(...args) {
    const window = getWindow();
    const events = args[0].split(' ');
    const eventData = args[1];

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];

      for (let j = 0; j < this.length; j += 1) {
        const el = this[j];

        if (window.CustomEvent) {
          const evt = new window.CustomEvent(event, {
            detail: eventData,
            bubbles: true,
            cancelable: true
          });
          el.dom7EventData = args.filter((data, dataIndex) => dataIndex > 0);
          el.dispatchEvent(evt);
          el.dom7EventData = [];
          delete el.dom7EventData;
        }
      }
    }

    return this;
  }

  function transitionEnd(callback) {
    const dom = this;

    function fireCallBack(e) {
      if (e.target !== this) return;
      callback.call(this, e);
      dom.off('transitionend', fireCallBack);
    }

    if (callback) {
      dom.on('transitionend', fireCallBack);
    }

    return this;
  }

  function outerWidth(includeMargins) {
    if (this.length > 0) {
      if (includeMargins) {
        const styles = this.styles();
        return this[0].offsetWidth + parseFloat(styles.getPropertyValue('margin-right')) + parseFloat(styles.getPropertyValue('margin-left'));
      }

      return this[0].offsetWidth;
    }

    return null;
  }

  function outerHeight(includeMargins) {
    if (this.length > 0) {
      if (includeMargins) {
        const styles = this.styles();
        return this[0].offsetHeight + parseFloat(styles.getPropertyValue('margin-top')) + parseFloat(styles.getPropertyValue('margin-bottom'));
      }

      return this[0].offsetHeight;
    }

    return null;
  }

  function offset() {
    if (this.length > 0) {
      const window = getWindow();
      const document = getDocument();
      const el = this[0];
      const box = el.getBoundingClientRect();
      const body = document.body;
      const clientTop = el.clientTop || body.clientTop || 0;
      const clientLeft = el.clientLeft || body.clientLeft || 0;
      const scrollTop = el === window ? window.scrollY : el.scrollTop;
      const scrollLeft = el === window ? window.scrollX : el.scrollLeft;
      return {
        top: box.top + scrollTop - clientTop,
        left: box.left + scrollLeft - clientLeft
      };
    }

    return null;
  }

  function styles() {
    const window = getWindow();
    if (this[0]) return window.getComputedStyle(this[0], null);
    return {};
  }

  function css(props, value) {
    const window = getWindow();
    let i;

    if (arguments.length === 1) {
      if (typeof props === 'string') {
        // .css('width')
        if (this[0]) return window.getComputedStyle(this[0], null).getPropertyValue(props);
      } else {
        // .css({ width: '100px' })
        for (i = 0; i < this.length; i += 1) {
          for (const prop in props) {
            this[i].style[prop] = props[prop];
          }
        }

        return this;
      }
    }

    if (arguments.length === 2 && typeof props === 'string') {
      // .css('width', '100px')
      for (i = 0; i < this.length; i += 1) {
        this[i].style[props] = value;
      }

      return this;
    }

    return this;
  }

  function each(callback) {
    if (!callback) return this;
    this.forEach((el, index) => {
      callback.apply(el, [el, index]);
    });
    return this;
  }

  function filter(callback) {
    const result = arrayFilter(this, callback);
    return $(result);
  }

  function html$1(html) {
    if (typeof html === 'undefined') {
      return this[0] ? this[0].innerHTML : null;
    }

    for (let i = 0; i < this.length; i += 1) {
      this[i].innerHTML = html;
    }

    return this;
  }

  function text(text) {
    if (typeof text === 'undefined') {
      return this[0] ? this[0].textContent.trim() : null;
    }

    for (let i = 0; i < this.length; i += 1) {
      this[i].textContent = text;
    }

    return this;
  }

  function is(selector) {
    const window = getWindow();
    const document = getDocument();
    const el = this[0];
    let compareWith;
    let i;
    if (!el || typeof selector === 'undefined') return false;

    if (typeof selector === 'string') {
      if (el.matches) return el.matches(selector);
      if (el.webkitMatchesSelector) return el.webkitMatchesSelector(selector);
      if (el.msMatchesSelector) return el.msMatchesSelector(selector);
      compareWith = $(selector);

      for (i = 0; i < compareWith.length; i += 1) {
        if (compareWith[i] === el) return true;
      }

      return false;
    }

    if (selector === document) {
      return el === document;
    }

    if (selector === window) {
      return el === window;
    }

    if (selector.nodeType || selector instanceof Dom7) {
      compareWith = selector.nodeType ? [selector] : selector;

      for (i = 0; i < compareWith.length; i += 1) {
        if (compareWith[i] === el) return true;
      }

      return false;
    }

    return false;
  }

  function index() {
    let child = this[0];
    let i;

    if (child) {
      i = 0; // eslint-disable-next-line

      while ((child = child.previousSibling) !== null) {
        if (child.nodeType === 1) i += 1;
      }

      return i;
    }

    return undefined;
  }

  function eq$1(index) {
    if (typeof index === 'undefined') return this;
    const length = this.length;

    if (index > length - 1) {
      return $([]);
    }

    if (index < 0) {
      const returnIndex = length + index;
      if (returnIndex < 0) return $([]);
      return $([this[returnIndex]]);
    }

    return $([this[index]]);
  }

  function append(...els) {
    let newChild;
    const document = getDocument();

    for (let k = 0; k < els.length; k += 1) {
      newChild = els[k];

      for (let i = 0; i < this.length; i += 1) {
        if (typeof newChild === 'string') {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = newChild;

          while (tempDiv.firstChild) {
            this[i].appendChild(tempDiv.firstChild);
          }
        } else if (newChild instanceof Dom7) {
          for (let j = 0; j < newChild.length; j += 1) {
            this[i].appendChild(newChild[j]);
          }
        } else {
          this[i].appendChild(newChild);
        }
      }
    }

    return this;
  }

  function prepend(newChild) {
    const document = getDocument();
    let i;
    let j;

    for (i = 0; i < this.length; i += 1) {
      if (typeof newChild === 'string') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newChild;

        for (j = tempDiv.childNodes.length - 1; j >= 0; j -= 1) {
          this[i].insertBefore(tempDiv.childNodes[j], this[i].childNodes[0]);
        }
      } else if (newChild instanceof Dom7) {
        for (j = 0; j < newChild.length; j += 1) {
          this[i].insertBefore(newChild[j], this[i].childNodes[0]);
        }
      } else {
        this[i].insertBefore(newChild, this[i].childNodes[0]);
      }
    }

    return this;
  }

  function next(selector) {
    if (this.length > 0) {
      if (selector) {
        if (this[0].nextElementSibling && $(this[0].nextElementSibling).is(selector)) {
          return $([this[0].nextElementSibling]);
        }

        return $([]);
      }

      if (this[0].nextElementSibling) return $([this[0].nextElementSibling]);
      return $([]);
    }

    return $([]);
  }

  function nextAll(selector) {
    const nextEls = [];
    let el = this[0];
    if (!el) return $([]);

    while (el.nextElementSibling) {
      const next = el.nextElementSibling; // eslint-disable-line

      if (selector) {
        if ($(next).is(selector)) nextEls.push(next);
      } else nextEls.push(next);

      el = next;
    }

    return $(nextEls);
  }

  function prev(selector) {
    if (this.length > 0) {
      const el = this[0];

      if (selector) {
        if (el.previousElementSibling && $(el.previousElementSibling).is(selector)) {
          return $([el.previousElementSibling]);
        }

        return $([]);
      }

      if (el.previousElementSibling) return $([el.previousElementSibling]);
      return $([]);
    }

    return $([]);
  }

  function prevAll(selector) {
    const prevEls = [];
    let el = this[0];
    if (!el) return $([]);

    while (el.previousElementSibling) {
      const prev = el.previousElementSibling; // eslint-disable-line

      if (selector) {
        if ($(prev).is(selector)) prevEls.push(prev);
      } else prevEls.push(prev);

      el = prev;
    }

    return $(prevEls);
  }

  function parent(selector) {
    const parents = []; // eslint-disable-line

    for (let i = 0; i < this.length; i += 1) {
      if (this[i].parentNode !== null) {
        if (selector) {
          if ($(this[i].parentNode).is(selector)) parents.push(this[i].parentNode);
        } else {
          parents.push(this[i].parentNode);
        }
      }
    }

    return $(parents);
  }

  function parents(selector) {
    const parents = []; // eslint-disable-line

    for (let i = 0; i < this.length; i += 1) {
      let parent = this[i].parentNode; // eslint-disable-line

      while (parent) {
        if (selector) {
          if ($(parent).is(selector)) parents.push(parent);
        } else {
          parents.push(parent);
        }

        parent = parent.parentNode;
      }
    }

    return $(parents);
  }

  function closest(selector) {
    let closest = this; // eslint-disable-line

    if (typeof selector === 'undefined') {
      return $([]);
    }

    if (!closest.is(selector)) {
      closest = closest.parents(selector).eq(0);
    }

    return closest;
  }

  function find$1(selector) {
    const foundElements = [];

    for (let i = 0; i < this.length; i += 1) {
      const found = this[i].querySelectorAll(selector);

      for (let j = 0; j < found.length; j += 1) {
        foundElements.push(found[j]);
      }
    }

    return $(foundElements);
  }

  function children(selector) {
    const children = []; // eslint-disable-line

    for (let i = 0; i < this.length; i += 1) {
      const childNodes = this[i].children;

      for (let j = 0; j < childNodes.length; j += 1) {
        if (!selector || $(childNodes[j]).is(selector)) {
          children.push(childNodes[j]);
        }
      }
    }

    return $(children);
  }

  function remove() {
    for (let i = 0; i < this.length; i += 1) {
      if (this[i].parentNode) this[i].parentNode.removeChild(this[i]);
    }

    return this;
  }

  const Methods = {
    addClass: addClass$1,
    removeClass: removeClass$1,
    hasClass,
    toggleClass,
    attr,
    removeAttr,
    transform,
    transition,
    on,
    off,
    trigger: trigger$1,
    transitionEnd,
    outerWidth,
    outerHeight,
    styles,
    offset,
    css,
    each,
    html: html$1,
    text,
    is,
    index,
    eq: eq$1,
    append,
    prepend,
    next,
    nextAll,
    prev,
    prevAll,
    parent,
    parents,
    closest,
    find: find$1,
    children,
    filter,
    remove
  };
  Object.keys(Methods).forEach(methodName => {
    Object.defineProperty($.fn, methodName, {
      value: Methods[methodName],
      writable: true
    });
  });

  function deleteProps(obj) {
    const object = obj;
    Object.keys(object).forEach(key => {
      try {
        object[key] = null;
      } catch (e) {// no getter for object
      }

      try {
        delete object[key];
      } catch (e) {// something got wrong
      }
    });
  }

  function nextTick(callback, delay = 0) {
    return setTimeout(callback, delay);
  }

  function now$2() {
    return Date.now();
  }

  function getComputedStyle$1(el) {
    const window = getWindow();
    let style;

    if (window.getComputedStyle) {
      style = window.getComputedStyle(el, null);
    }

    if (!style && el.currentStyle) {
      style = el.currentStyle;
    }

    if (!style) {
      style = el.style;
    }

    return style;
  }

  function getTranslate$1(el, axis = 'x') {
    const window = getWindow();
    let matrix;
    let curTransform;
    let transformMatrix;
    const curStyle = getComputedStyle$1(el);

    if (window.WebKitCSSMatrix) {
      curTransform = curStyle.transform || curStyle.webkitTransform;

      if (curTransform.split(',').length > 6) {
        curTransform = curTransform.split(', ').map(a => a.replace(',', '.')).join(', ');
      } // Some old versions of Webkit choke when 'none' is passed; pass
      // empty string instead in this case


      transformMatrix = new window.WebKitCSSMatrix(curTransform === 'none' ? '' : curTransform);
    } else {
      transformMatrix = curStyle.MozTransform || curStyle.OTransform || curStyle.MsTransform || curStyle.msTransform || curStyle.transform || curStyle.getPropertyValue('transform').replace('translate(', 'matrix(1, 0, 0, 1,');
      matrix = transformMatrix.toString().split(',');
    }

    if (axis === 'x') {
      // Latest Chrome and webkits Fix
      if (window.WebKitCSSMatrix) curTransform = transformMatrix.m41; // Crazy IE10 Matrix
      else if (matrix.length === 16) curTransform = parseFloat(matrix[12]); // Normal Browsers
      else curTransform = parseFloat(matrix[4]);
    }

    if (axis === 'y') {
      // Latest Chrome and webkits Fix
      if (window.WebKitCSSMatrix) curTransform = transformMatrix.m42; // Crazy IE10 Matrix
      else if (matrix.length === 16) curTransform = parseFloat(matrix[13]); // Normal Browsers
      else curTransform = parseFloat(matrix[5]);
    }

    return curTransform || 0;
  }

  function isObject$5(o) {
    return typeof o === 'object' && o !== null && o.constructor && Object.prototype.toString.call(o).slice(8, -1) === 'Object';
  }

  function isNode(node) {
    // eslint-disable-next-line
    if (typeof window !== 'undefined' && typeof window.HTMLElement !== 'undefined') {
      return node instanceof HTMLElement;
    }

    return node && (node.nodeType === 1 || node.nodeType === 11);
  }

  function extend$1(...args) {
    const to = Object(args[0]);
    const noExtend = ['__proto__', 'constructor', 'prototype'];

    for (let i = 1; i < args.length; i += 1) {
      const nextSource = args[i];

      if (nextSource !== undefined && nextSource !== null && !isNode(nextSource)) {
        const keysArray = Object.keys(Object(nextSource)).filter(key => noExtend.indexOf(key) < 0);

        for (let nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex += 1) {
          const nextKey = keysArray[nextIndex];
          const desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);

          if (desc !== undefined && desc.enumerable) {
            if (isObject$5(to[nextKey]) && isObject$5(nextSource[nextKey])) {
              if (nextSource[nextKey].__swiper__) {
                to[nextKey] = nextSource[nextKey];
              } else {
                extend$1(to[nextKey], nextSource[nextKey]);
              }
            } else if (!isObject$5(to[nextKey]) && isObject$5(nextSource[nextKey])) {
              to[nextKey] = {};

              if (nextSource[nextKey].__swiper__) {
                to[nextKey] = nextSource[nextKey];
              } else {
                extend$1(to[nextKey], nextSource[nextKey]);
              }
            } else {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
    }

    return to;
  }

  function setCSSProperty(el, varName, varValue) {
    el.style.setProperty(varName, varValue);
  }

  function animateCSSModeScroll({
    swiper,
    targetPosition,
    side
  }) {
    const window = getWindow();
    const startPosition = -swiper.translate;
    let startTime = null;
    let time;
    const duration = swiper.params.speed;
    swiper.wrapperEl.style.scrollSnapType = 'none';
    window.cancelAnimationFrame(swiper.cssModeFrameID);
    const dir = targetPosition > startPosition ? 'next' : 'prev';

    const isOutOfBound = (current, target) => {
      return dir === 'next' && current >= target || dir === 'prev' && current <= target;
    };

    const animate = () => {
      time = new Date().getTime();

      if (startTime === null) {
        startTime = time;
      }

      const progress = Math.max(Math.min((time - startTime) / duration, 1), 0);
      const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
      let currentPosition = startPosition + easeProgress * (targetPosition - startPosition);

      if (isOutOfBound(currentPosition, targetPosition)) {
        currentPosition = targetPosition;
      }

      swiper.wrapperEl.scrollTo({
        [side]: currentPosition
      });

      if (isOutOfBound(currentPosition, targetPosition)) {
        swiper.wrapperEl.style.overflow = 'hidden';
        swiper.wrapperEl.style.scrollSnapType = '';
        setTimeout(() => {
          swiper.wrapperEl.style.overflow = '';
          swiper.wrapperEl.scrollTo({
            [side]: currentPosition
          });
        });
        window.cancelAnimationFrame(swiper.cssModeFrameID);
        return;
      }

      swiper.cssModeFrameID = window.requestAnimationFrame(animate);
    };

    animate();
  }

  let support$1;

  function calcSupport() {
    const window = getWindow();
    const document = getDocument();
    return {
      smoothScroll: document.documentElement && 'scrollBehavior' in document.documentElement.style,
      touch: !!('ontouchstart' in window || window.DocumentTouch && document instanceof window.DocumentTouch),
      passiveListener: function checkPassiveListener() {
        let supportsPassive = false;

        try {
          const opts = Object.defineProperty({}, 'passive', {
            // eslint-disable-next-line
            get() {
              supportsPassive = true;
            }

          });
          window.addEventListener('testPassiveListener', null, opts);
        } catch (e) {// No support
        }

        return supportsPassive;
      }(),
      gestures: function checkGestures() {
        return 'ongesturestart' in window;
      }()
    };
  }

  function getSupport() {
    if (!support$1) {
      support$1 = calcSupport();
    }

    return support$1;
  }

  let deviceCached;

  function calcDevice({
    userAgent
  } = {}) {
    const support = getSupport();
    const window = getWindow();
    const platform = window.navigator.platform;
    const ua = userAgent || window.navigator.userAgent;
    const device = {
      ios: false,
      android: false
    };
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const android = ua.match(/(Android);?[\s\/]+([\d.]+)?/); // eslint-disable-line

    let ipad = ua.match(/(iPad).*OS\s([\d_]+)/);
    const ipod = ua.match(/(iPod)(.*OS\s([\d_]+))?/);
    const iphone = !ipad && ua.match(/(iPhone\sOS|iOS)\s([\d_]+)/);
    const windows = platform === 'Win32';
    let macos = platform === 'MacIntel'; // iPadOs 13 fix

    const iPadScreens = ['1024x1366', '1366x1024', '834x1194', '1194x834', '834x1112', '1112x834', '768x1024', '1024x768', '820x1180', '1180x820', '810x1080', '1080x810'];

    if (!ipad && macos && support.touch && iPadScreens.indexOf(`${screenWidth}x${screenHeight}`) >= 0) {
      ipad = ua.match(/(Version)\/([\d.]+)/);
      if (!ipad) ipad = [0, 1, '13_0_0'];
      macos = false;
    } // Android


    if (android && !windows) {
      device.os = 'android';
      device.android = true;
    }

    if (ipad || iphone || ipod) {
      device.os = 'ios';
      device.ios = true;
    } // Export object


    return device;
  }

  function getDevice(overrides = {}) {
    if (!deviceCached) {
      deviceCached = calcDevice(overrides);
    }

    return deviceCached;
  }

  let browser;

  function calcBrowser() {
    const window = getWindow();

    function isSafari() {
      const ua = window.navigator.userAgent.toLowerCase();
      return ua.indexOf('safari') >= 0 && ua.indexOf('chrome') < 0 && ua.indexOf('android') < 0;
    }

    return {
      isSafari: isSafari(),
      isWebView: /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(window.navigator.userAgent)
    };
  }

  function getBrowser() {
    if (!browser) {
      browser = calcBrowser();
    }

    return browser;
  }

  function Resize({
    swiper,
    on,
    emit
  }) {
    const window = getWindow();
    let observer = null;
    let animationFrame = null;

    const resizeHandler = () => {
      if (!swiper || swiper.destroyed || !swiper.initialized) return;
      emit('beforeResize');
      emit('resize');
    };

    const createObserver = () => {
      if (!swiper || swiper.destroyed || !swiper.initialized) return;
      observer = new ResizeObserver(entries => {
        animationFrame = window.requestAnimationFrame(() => {
          const {
            width,
            height
          } = swiper;
          let newWidth = width;
          let newHeight = height;
          entries.forEach(({
            contentBoxSize,
            contentRect,
            target
          }) => {
            if (target && target !== swiper.el) return;
            newWidth = contentRect ? contentRect.width : (contentBoxSize[0] || contentBoxSize).inlineSize;
            newHeight = contentRect ? contentRect.height : (contentBoxSize[0] || contentBoxSize).blockSize;
          });

          if (newWidth !== width || newHeight !== height) {
            resizeHandler();
          }
        });
      });
      observer.observe(swiper.el);
    };

    const removeObserver = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      if (observer && observer.unobserve && swiper.el) {
        observer.unobserve(swiper.el);
        observer = null;
      }
    };

    const orientationChangeHandler = () => {
      if (!swiper || swiper.destroyed || !swiper.initialized) return;
      emit('orientationchange');
    };

    on('init', () => {
      if (swiper.params.resizeObserver && typeof window.ResizeObserver !== 'undefined') {
        createObserver();
        return;
      }

      window.addEventListener('resize', resizeHandler);
      window.addEventListener('orientationchange', orientationChangeHandler);
    });
    on('destroy', () => {
      removeObserver();
      window.removeEventListener('resize', resizeHandler);
      window.removeEventListener('orientationchange', orientationChangeHandler);
    });
  }

  function Observer({
    swiper,
    extendParams,
    on,
    emit
  }) {
    const observers = [];
    const window = getWindow();

    const attach = (target, options = {}) => {
      const ObserverFunc = window.MutationObserver || window.WebkitMutationObserver;
      const observer = new ObserverFunc(mutations => {
        // The observerUpdate event should only be triggered
        // once despite the number of mutations.  Additional
        // triggers are redundant and are very costly
        if (mutations.length === 1) {
          emit('observerUpdate', mutations[0]);
          return;
        }

        const observerUpdate = function observerUpdate() {
          emit('observerUpdate', mutations[0]);
        };

        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(observerUpdate);
        } else {
          window.setTimeout(observerUpdate, 0);
        }
      });
      observer.observe(target, {
        attributes: typeof options.attributes === 'undefined' ? true : options.attributes,
        childList: typeof options.childList === 'undefined' ? true : options.childList,
        characterData: typeof options.characterData === 'undefined' ? true : options.characterData
      });
      observers.push(observer);
    };

    const init = () => {
      if (!swiper.params.observer) return;

      if (swiper.params.observeParents) {
        const containerParents = swiper.$el.parents();

        for (let i = 0; i < containerParents.length; i += 1) {
          attach(containerParents[i]);
        }
      } // Observe container


      attach(swiper.$el[0], {
        childList: swiper.params.observeSlideChildren
      }); // Observe wrapper

      attach(swiper.$wrapperEl[0], {
        attributes: false
      });
    };

    const destroy = () => {
      observers.forEach(observer => {
        observer.disconnect();
      });
      observers.splice(0, observers.length);
    };

    extendParams({
      observer: false,
      observeParents: false,
      observeSlideChildren: false
    });
    on('init', init);
    on('destroy', destroy);
  }

  /* eslint-disable no-underscore-dangle */
  var eventsEmitter = {
    on(events, handler, priority) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (typeof handler !== 'function') return self;
      const method = priority ? 'unshift' : 'push';
      events.split(' ').forEach(event => {
        if (!self.eventsListeners[event]) self.eventsListeners[event] = [];
        self.eventsListeners[event][method](handler);
      });
      return self;
    },

    once(events, handler, priority) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (typeof handler !== 'function') return self;

      function onceHandler(...args) {
        self.off(events, onceHandler);

        if (onceHandler.__emitterProxy) {
          delete onceHandler.__emitterProxy;
        }

        handler.apply(self, args);
      }

      onceHandler.__emitterProxy = handler;
      return self.on(events, onceHandler, priority);
    },

    onAny(handler, priority) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (typeof handler !== 'function') return self;
      const method = priority ? 'unshift' : 'push';

      if (self.eventsAnyListeners.indexOf(handler) < 0) {
        self.eventsAnyListeners[method](handler);
      }

      return self;
    },

    offAny(handler) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (!self.eventsAnyListeners) return self;
      const index = self.eventsAnyListeners.indexOf(handler);

      if (index >= 0) {
        self.eventsAnyListeners.splice(index, 1);
      }

      return self;
    },

    off(events, handler) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (!self.eventsListeners) return self;
      events.split(' ').forEach(event => {
        if (typeof handler === 'undefined') {
          self.eventsListeners[event] = [];
        } else if (self.eventsListeners[event]) {
          self.eventsListeners[event].forEach((eventHandler, index) => {
            if (eventHandler === handler || eventHandler.__emitterProxy && eventHandler.__emitterProxy === handler) {
              self.eventsListeners[event].splice(index, 1);
            }
          });
        }
      });
      return self;
    },

    emit(...args) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (!self.eventsListeners) return self;
      let events;
      let data;
      let context;

      if (typeof args[0] === 'string' || Array.isArray(args[0])) {
        events = args[0];
        data = args.slice(1, args.length);
        context = self;
      } else {
        events = args[0].events;
        data = args[0].data;
        context = args[0].context || self;
      }

      data.unshift(context);
      const eventsArray = Array.isArray(events) ? events : events.split(' ');
      eventsArray.forEach(event => {
        if (self.eventsAnyListeners && self.eventsAnyListeners.length) {
          self.eventsAnyListeners.forEach(eventHandler => {
            eventHandler.apply(context, [event, ...data]);
          });
        }

        if (self.eventsListeners && self.eventsListeners[event]) {
          self.eventsListeners[event].forEach(eventHandler => {
            eventHandler.apply(context, data);
          });
        }
      });
      return self;
    }

  };

  function updateSize() {
    const swiper = this;
    let width;
    let height;
    const $el = swiper.$el;

    if (typeof swiper.params.width !== 'undefined' && swiper.params.width !== null) {
      width = swiper.params.width;
    } else {
      width = $el[0].clientWidth;
    }

    if (typeof swiper.params.height !== 'undefined' && swiper.params.height !== null) {
      height = swiper.params.height;
    } else {
      height = $el[0].clientHeight;
    }

    if (width === 0 && swiper.isHorizontal() || height === 0 && swiper.isVertical()) {
      return;
    } // Subtract paddings


    width = width - parseInt($el.css('padding-left') || 0, 10) - parseInt($el.css('padding-right') || 0, 10);
    height = height - parseInt($el.css('padding-top') || 0, 10) - parseInt($el.css('padding-bottom') || 0, 10);
    if (Number.isNaN(width)) width = 0;
    if (Number.isNaN(height)) height = 0;
    Object.assign(swiper, {
      width,
      height,
      size: swiper.isHorizontal() ? width : height
    });
  }

  function updateSlides() {
    const swiper = this;

    function getDirectionLabel(property) {
      if (swiper.isHorizontal()) {
        return property;
      } // prettier-ignore


      return {
        'width': 'height',
        'margin-top': 'margin-left',
        'margin-bottom ': 'margin-right',
        'margin-left': 'margin-top',
        'margin-right': 'margin-bottom',
        'padding-left': 'padding-top',
        'padding-right': 'padding-bottom',
        'marginRight': 'marginBottom'
      }[property];
    }

    function getDirectionPropertyValue(node, label) {
      return parseFloat(node.getPropertyValue(getDirectionLabel(label)) || 0);
    }

    const params = swiper.params;
    const {
      $wrapperEl,
      size: swiperSize,
      rtlTranslate: rtl,
      wrongRTL
    } = swiper;
    const isVirtual = swiper.virtual && params.virtual.enabled;
    const previousSlidesLength = isVirtual ? swiper.virtual.slides.length : swiper.slides.length;
    const slides = $wrapperEl.children(`.${swiper.params.slideClass}`);
    const slidesLength = isVirtual ? swiper.virtual.slides.length : slides.length;
    let snapGrid = [];
    const slidesGrid = [];
    const slidesSizesGrid = [];
    let offsetBefore = params.slidesOffsetBefore;

    if (typeof offsetBefore === 'function') {
      offsetBefore = params.slidesOffsetBefore.call(swiper);
    }

    let offsetAfter = params.slidesOffsetAfter;

    if (typeof offsetAfter === 'function') {
      offsetAfter = params.slidesOffsetAfter.call(swiper);
    }

    const previousSnapGridLength = swiper.snapGrid.length;
    const previousSlidesGridLength = swiper.slidesGrid.length;
    let spaceBetween = params.spaceBetween;
    let slidePosition = -offsetBefore;
    let prevSlideSize = 0;
    let index = 0;

    if (typeof swiperSize === 'undefined') {
      return;
    }

    if (typeof spaceBetween === 'string' && spaceBetween.indexOf('%') >= 0) {
      spaceBetween = parseFloat(spaceBetween.replace('%', '')) / 100 * swiperSize;
    }

    swiper.virtualSize = -spaceBetween; // reset margins

    if (rtl) slides.css({
      marginLeft: '',
      marginBottom: '',
      marginTop: ''
    });else slides.css({
      marginRight: '',
      marginBottom: '',
      marginTop: ''
    }); // reset cssMode offsets

    if (params.centeredSlides && params.cssMode) {
      setCSSProperty(swiper.wrapperEl, '--swiper-centered-offset-before', '');
      setCSSProperty(swiper.wrapperEl, '--swiper-centered-offset-after', '');
    }

    const gridEnabled = params.grid && params.grid.rows > 1 && swiper.grid;

    if (gridEnabled) {
      swiper.grid.initSlides(slidesLength);
    } // Calc slides


    let slideSize;
    const shouldResetSlideSize = params.slidesPerView === 'auto' && params.breakpoints && Object.keys(params.breakpoints).filter(key => {
      return typeof params.breakpoints[key].slidesPerView !== 'undefined';
    }).length > 0;

    for (let i = 0; i < slidesLength; i += 1) {
      slideSize = 0;
      const slide = slides.eq(i);

      if (gridEnabled) {
        swiper.grid.updateSlide(i, slide, slidesLength, getDirectionLabel);
      }

      if (slide.css('display') === 'none') continue; // eslint-disable-line

      if (params.slidesPerView === 'auto') {
        if (shouldResetSlideSize) {
          slides[i].style[getDirectionLabel('width')] = ``;
        }

        const slideStyles = getComputedStyle(slide[0]);
        const currentTransform = slide[0].style.transform;
        const currentWebKitTransform = slide[0].style.webkitTransform;

        if (currentTransform) {
          slide[0].style.transform = 'none';
        }

        if (currentWebKitTransform) {
          slide[0].style.webkitTransform = 'none';
        }

        if (params.roundLengths) {
          slideSize = swiper.isHorizontal() ? slide.outerWidth(true) : slide.outerHeight(true);
        } else {
          // eslint-disable-next-line
          const width = getDirectionPropertyValue(slideStyles, 'width');
          const paddingLeft = getDirectionPropertyValue(slideStyles, 'padding-left');
          const paddingRight = getDirectionPropertyValue(slideStyles, 'padding-right');
          const marginLeft = getDirectionPropertyValue(slideStyles, 'margin-left');
          const marginRight = getDirectionPropertyValue(slideStyles, 'margin-right');
          const boxSizing = slideStyles.getPropertyValue('box-sizing');

          if (boxSizing && boxSizing === 'border-box') {
            slideSize = width + marginLeft + marginRight;
          } else {
            const {
              clientWidth,
              offsetWidth
            } = slide[0];
            slideSize = width + paddingLeft + paddingRight + marginLeft + marginRight + (offsetWidth - clientWidth);
          }
        }

        if (currentTransform) {
          slide[0].style.transform = currentTransform;
        }

        if (currentWebKitTransform) {
          slide[0].style.webkitTransform = currentWebKitTransform;
        }

        if (params.roundLengths) slideSize = Math.floor(slideSize);
      } else {
        slideSize = (swiperSize - (params.slidesPerView - 1) * spaceBetween) / params.slidesPerView;
        if (params.roundLengths) slideSize = Math.floor(slideSize);

        if (slides[i]) {
          slides[i].style[getDirectionLabel('width')] = `${slideSize}px`;
        }
      }

      if (slides[i]) {
        slides[i].swiperSlideSize = slideSize;
      }

      slidesSizesGrid.push(slideSize);

      if (params.centeredSlides) {
        slidePosition = slidePosition + slideSize / 2 + prevSlideSize / 2 + spaceBetween;
        if (prevSlideSize === 0 && i !== 0) slidePosition = slidePosition - swiperSize / 2 - spaceBetween;
        if (i === 0) slidePosition = slidePosition - swiperSize / 2 - spaceBetween;
        if (Math.abs(slidePosition) < 1 / 1000) slidePosition = 0;
        if (params.roundLengths) slidePosition = Math.floor(slidePosition);
        if (index % params.slidesPerGroup === 0) snapGrid.push(slidePosition);
        slidesGrid.push(slidePosition);
      } else {
        if (params.roundLengths) slidePosition = Math.floor(slidePosition);
        if ((index - Math.min(swiper.params.slidesPerGroupSkip, index)) % swiper.params.slidesPerGroup === 0) snapGrid.push(slidePosition);
        slidesGrid.push(slidePosition);
        slidePosition = slidePosition + slideSize + spaceBetween;
      }

      swiper.virtualSize += slideSize + spaceBetween;
      prevSlideSize = slideSize;
      index += 1;
    }

    swiper.virtualSize = Math.max(swiper.virtualSize, swiperSize) + offsetAfter;

    if (rtl && wrongRTL && (params.effect === 'slide' || params.effect === 'coverflow')) {
      $wrapperEl.css({
        width: `${swiper.virtualSize + params.spaceBetween}px`
      });
    }

    if (params.setWrapperSize) {
      $wrapperEl.css({
        [getDirectionLabel('width')]: `${swiper.virtualSize + params.spaceBetween}px`
      });
    }

    if (gridEnabled) {
      swiper.grid.updateWrapperSize(slideSize, snapGrid, getDirectionLabel);
    } // Remove last grid elements depending on width


    if (!params.centeredSlides) {
      const newSlidesGrid = [];

      for (let i = 0; i < snapGrid.length; i += 1) {
        let slidesGridItem = snapGrid[i];
        if (params.roundLengths) slidesGridItem = Math.floor(slidesGridItem);

        if (snapGrid[i] <= swiper.virtualSize - swiperSize) {
          newSlidesGrid.push(slidesGridItem);
        }
      }

      snapGrid = newSlidesGrid;

      if (Math.floor(swiper.virtualSize - swiperSize) - Math.floor(snapGrid[snapGrid.length - 1]) > 1) {
        snapGrid.push(swiper.virtualSize - swiperSize);
      }
    }

    if (snapGrid.length === 0) snapGrid = [0];

    if (params.spaceBetween !== 0) {
      const key = swiper.isHorizontal() && rtl ? 'marginLeft' : getDirectionLabel('marginRight');
      slides.filter((_, slideIndex) => {
        if (!params.cssMode) return true;

        if (slideIndex === slides.length - 1) {
          return false;
        }

        return true;
      }).css({
        [key]: `${spaceBetween}px`
      });
    }

    if (params.centeredSlides && params.centeredSlidesBounds) {
      let allSlidesSize = 0;
      slidesSizesGrid.forEach(slideSizeValue => {
        allSlidesSize += slideSizeValue + (params.spaceBetween ? params.spaceBetween : 0);
      });
      allSlidesSize -= params.spaceBetween;
      const maxSnap = allSlidesSize - swiperSize;
      snapGrid = snapGrid.map(snap => {
        if (snap < 0) return -offsetBefore;
        if (snap > maxSnap) return maxSnap + offsetAfter;
        return snap;
      });
    }

    if (params.centerInsufficientSlides) {
      let allSlidesSize = 0;
      slidesSizesGrid.forEach(slideSizeValue => {
        allSlidesSize += slideSizeValue + (params.spaceBetween ? params.spaceBetween : 0);
      });
      allSlidesSize -= params.spaceBetween;

      if (allSlidesSize < swiperSize) {
        const allSlidesOffset = (swiperSize - allSlidesSize) / 2;
        snapGrid.forEach((snap, snapIndex) => {
          snapGrid[snapIndex] = snap - allSlidesOffset;
        });
        slidesGrid.forEach((snap, snapIndex) => {
          slidesGrid[snapIndex] = snap + allSlidesOffset;
        });
      }
    }

    Object.assign(swiper, {
      slides,
      snapGrid,
      slidesGrid,
      slidesSizesGrid
    });

    if (params.centeredSlides && params.cssMode && !params.centeredSlidesBounds) {
      setCSSProperty(swiper.wrapperEl, '--swiper-centered-offset-before', `${-snapGrid[0]}px`);
      setCSSProperty(swiper.wrapperEl, '--swiper-centered-offset-after', `${swiper.size / 2 - slidesSizesGrid[slidesSizesGrid.length - 1] / 2}px`);
      const addToSnapGrid = -swiper.snapGrid[0];
      const addToSlidesGrid = -swiper.slidesGrid[0];
      swiper.snapGrid = swiper.snapGrid.map(v => v + addToSnapGrid);
      swiper.slidesGrid = swiper.slidesGrid.map(v => v + addToSlidesGrid);
    }

    if (slidesLength !== previousSlidesLength) {
      swiper.emit('slidesLengthChange');
    }

    if (snapGrid.length !== previousSnapGridLength) {
      if (swiper.params.watchOverflow) swiper.checkOverflow();
      swiper.emit('snapGridLengthChange');
    }

    if (slidesGrid.length !== previousSlidesGridLength) {
      swiper.emit('slidesGridLengthChange');
    }

    if (params.watchSlidesProgress) {
      swiper.updateSlidesOffset();
    }

    if (!isVirtual && !params.cssMode && (params.effect === 'slide' || params.effect === 'fade')) {
      const backFaceHiddenClass = `${params.containerModifierClass}backface-hidden`;
      const hasClassBackfaceClassAdded = swiper.$el.hasClass(backFaceHiddenClass);

      if (slidesLength <= params.maxBackfaceHiddenSlides) {
        if (!hasClassBackfaceClassAdded) swiper.$el.addClass(backFaceHiddenClass);
      } else if (hasClassBackfaceClassAdded) {
        swiper.$el.removeClass(backFaceHiddenClass);
      }
    }
  }

  function updateAutoHeight(speed) {
    const swiper = this;
    const activeSlides = [];
    const isVirtual = swiper.virtual && swiper.params.virtual.enabled;
    let newHeight = 0;
    let i;

    if (typeof speed === 'number') {
      swiper.setTransition(speed);
    } else if (speed === true) {
      swiper.setTransition(swiper.params.speed);
    }

    const getSlideByIndex = index => {
      if (isVirtual) {
        return swiper.slides.filter(el => parseInt(el.getAttribute('data-swiper-slide-index'), 10) === index)[0];
      }

      return swiper.slides.eq(index)[0];
    }; // Find slides currently in view


    if (swiper.params.slidesPerView !== 'auto' && swiper.params.slidesPerView > 1) {
      if (swiper.params.centeredSlides) {
        (swiper.visibleSlides || $([])).each(slide => {
          activeSlides.push(slide);
        });
      } else {
        for (i = 0; i < Math.ceil(swiper.params.slidesPerView); i += 1) {
          const index = swiper.activeIndex + i;
          if (index > swiper.slides.length && !isVirtual) break;
          activeSlides.push(getSlideByIndex(index));
        }
      }
    } else {
      activeSlides.push(getSlideByIndex(swiper.activeIndex));
    } // Find new height from highest slide in view


    for (i = 0; i < activeSlides.length; i += 1) {
      if (typeof activeSlides[i] !== 'undefined') {
        const height = activeSlides[i].offsetHeight;
        newHeight = height > newHeight ? height : newHeight;
      }
    } // Update Height


    if (newHeight || newHeight === 0) swiper.$wrapperEl.css('height', `${newHeight}px`);
  }

  function updateSlidesOffset() {
    const swiper = this;
    const slides = swiper.slides;

    for (let i = 0; i < slides.length; i += 1) {
      slides[i].swiperSlideOffset = swiper.isHorizontal() ? slides[i].offsetLeft : slides[i].offsetTop;
    }
  }

  function updateSlidesProgress(translate = this && this.translate || 0) {
    const swiper = this;
    const params = swiper.params;
    const {
      slides,
      rtlTranslate: rtl,
      snapGrid
    } = swiper;
    if (slides.length === 0) return;
    if (typeof slides[0].swiperSlideOffset === 'undefined') swiper.updateSlidesOffset();
    let offsetCenter = -translate;
    if (rtl) offsetCenter = translate; // Visible Slides

    slides.removeClass(params.slideVisibleClass);
    swiper.visibleSlidesIndexes = [];
    swiper.visibleSlides = [];

    for (let i = 0; i < slides.length; i += 1) {
      const slide = slides[i];
      let slideOffset = slide.swiperSlideOffset;

      if (params.cssMode && params.centeredSlides) {
        slideOffset -= slides[0].swiperSlideOffset;
      }

      const slideProgress = (offsetCenter + (params.centeredSlides ? swiper.minTranslate() : 0) - slideOffset) / (slide.swiperSlideSize + params.spaceBetween);
      const originalSlideProgress = (offsetCenter - snapGrid[0] + (params.centeredSlides ? swiper.minTranslate() : 0) - slideOffset) / (slide.swiperSlideSize + params.spaceBetween);
      const slideBefore = -(offsetCenter - slideOffset);
      const slideAfter = slideBefore + swiper.slidesSizesGrid[i];
      const isVisible = slideBefore >= 0 && slideBefore < swiper.size - 1 || slideAfter > 1 && slideAfter <= swiper.size || slideBefore <= 0 && slideAfter >= swiper.size;

      if (isVisible) {
        swiper.visibleSlides.push(slide);
        swiper.visibleSlidesIndexes.push(i);
        slides.eq(i).addClass(params.slideVisibleClass);
      }

      slide.progress = rtl ? -slideProgress : slideProgress;
      slide.originalProgress = rtl ? -originalSlideProgress : originalSlideProgress;
    }

    swiper.visibleSlides = $(swiper.visibleSlides);
  }

  function updateProgress(translate) {
    const swiper = this;

    if (typeof translate === 'undefined') {
      const multiplier = swiper.rtlTranslate ? -1 : 1; // eslint-disable-next-line

      translate = swiper && swiper.translate && swiper.translate * multiplier || 0;
    }

    const params = swiper.params;
    const translatesDiff = swiper.maxTranslate() - swiper.minTranslate();
    let {
      progress,
      isBeginning,
      isEnd
    } = swiper;
    const wasBeginning = isBeginning;
    const wasEnd = isEnd;

    if (translatesDiff === 0) {
      progress = 0;
      isBeginning = true;
      isEnd = true;
    } else {
      progress = (translate - swiper.minTranslate()) / translatesDiff;
      isBeginning = progress <= 0;
      isEnd = progress >= 1;
    }

    Object.assign(swiper, {
      progress,
      isBeginning,
      isEnd
    });
    if (params.watchSlidesProgress || params.centeredSlides && params.autoHeight) swiper.updateSlidesProgress(translate);

    if (isBeginning && !wasBeginning) {
      swiper.emit('reachBeginning toEdge');
    }

    if (isEnd && !wasEnd) {
      swiper.emit('reachEnd toEdge');
    }

    if (wasBeginning && !isBeginning || wasEnd && !isEnd) {
      swiper.emit('fromEdge');
    }

    swiper.emit('progress', progress);
  }

  function updateSlidesClasses() {
    const swiper = this;
    const {
      slides,
      params,
      $wrapperEl,
      activeIndex,
      realIndex
    } = swiper;
    const isVirtual = swiper.virtual && params.virtual.enabled;
    slides.removeClass(`${params.slideActiveClass} ${params.slideNextClass} ${params.slidePrevClass} ${params.slideDuplicateActiveClass} ${params.slideDuplicateNextClass} ${params.slideDuplicatePrevClass}`);
    let activeSlide;

    if (isVirtual) {
      activeSlide = swiper.$wrapperEl.find(`.${params.slideClass}[data-swiper-slide-index="${activeIndex}"]`);
    } else {
      activeSlide = slides.eq(activeIndex);
    } // Active classes


    activeSlide.addClass(params.slideActiveClass);

    if (params.loop) {
      // Duplicate to all looped slides
      if (activeSlide.hasClass(params.slideDuplicateClass)) {
        $wrapperEl.children(`.${params.slideClass}:not(.${params.slideDuplicateClass})[data-swiper-slide-index="${realIndex}"]`).addClass(params.slideDuplicateActiveClass);
      } else {
        $wrapperEl.children(`.${params.slideClass}.${params.slideDuplicateClass}[data-swiper-slide-index="${realIndex}"]`).addClass(params.slideDuplicateActiveClass);
      }
    } // Next Slide


    let nextSlide = activeSlide.nextAll(`.${params.slideClass}`).eq(0).addClass(params.slideNextClass);

    if (params.loop && nextSlide.length === 0) {
      nextSlide = slides.eq(0);
      nextSlide.addClass(params.slideNextClass);
    } // Prev Slide


    let prevSlide = activeSlide.prevAll(`.${params.slideClass}`).eq(0).addClass(params.slidePrevClass);

    if (params.loop && prevSlide.length === 0) {
      prevSlide = slides.eq(-1);
      prevSlide.addClass(params.slidePrevClass);
    }

    if (params.loop) {
      // Duplicate to all looped slides
      if (nextSlide.hasClass(params.slideDuplicateClass)) {
        $wrapperEl.children(`.${params.slideClass}:not(.${params.slideDuplicateClass})[data-swiper-slide-index="${nextSlide.attr('data-swiper-slide-index')}"]`).addClass(params.slideDuplicateNextClass);
      } else {
        $wrapperEl.children(`.${params.slideClass}.${params.slideDuplicateClass}[data-swiper-slide-index="${nextSlide.attr('data-swiper-slide-index')}"]`).addClass(params.slideDuplicateNextClass);
      }

      if (prevSlide.hasClass(params.slideDuplicateClass)) {
        $wrapperEl.children(`.${params.slideClass}:not(.${params.slideDuplicateClass})[data-swiper-slide-index="${prevSlide.attr('data-swiper-slide-index')}"]`).addClass(params.slideDuplicatePrevClass);
      } else {
        $wrapperEl.children(`.${params.slideClass}.${params.slideDuplicateClass}[data-swiper-slide-index="${prevSlide.attr('data-swiper-slide-index')}"]`).addClass(params.slideDuplicatePrevClass);
      }
    }

    swiper.emitSlidesClasses();
  }

  function updateActiveIndex(newActiveIndex) {
    const swiper = this;
    const translate = swiper.rtlTranslate ? swiper.translate : -swiper.translate;
    const {
      slidesGrid,
      snapGrid,
      params,
      activeIndex: previousIndex,
      realIndex: previousRealIndex,
      snapIndex: previousSnapIndex
    } = swiper;
    let activeIndex = newActiveIndex;
    let snapIndex;

    if (typeof activeIndex === 'undefined') {
      for (let i = 0; i < slidesGrid.length; i += 1) {
        if (typeof slidesGrid[i + 1] !== 'undefined') {
          if (translate >= slidesGrid[i] && translate < slidesGrid[i + 1] - (slidesGrid[i + 1] - slidesGrid[i]) / 2) {
            activeIndex = i;
          } else if (translate >= slidesGrid[i] && translate < slidesGrid[i + 1]) {
            activeIndex = i + 1;
          }
        } else if (translate >= slidesGrid[i]) {
          activeIndex = i;
        }
      } // Normalize slideIndex


      if (params.normalizeSlideIndex) {
        if (activeIndex < 0 || typeof activeIndex === 'undefined') activeIndex = 0;
      }
    }

    if (snapGrid.indexOf(translate) >= 0) {
      snapIndex = snapGrid.indexOf(translate);
    } else {
      const skip = Math.min(params.slidesPerGroupSkip, activeIndex);
      snapIndex = skip + Math.floor((activeIndex - skip) / params.slidesPerGroup);
    }

    if (snapIndex >= snapGrid.length) snapIndex = snapGrid.length - 1;

    if (activeIndex === previousIndex) {
      if (snapIndex !== previousSnapIndex) {
        swiper.snapIndex = snapIndex;
        swiper.emit('snapIndexChange');
      }

      return;
    } // Get real index


    const realIndex = parseInt(swiper.slides.eq(activeIndex).attr('data-swiper-slide-index') || activeIndex, 10);
    Object.assign(swiper, {
      snapIndex,
      realIndex,
      previousIndex,
      activeIndex
    });
    swiper.emit('activeIndexChange');
    swiper.emit('snapIndexChange');

    if (previousRealIndex !== realIndex) {
      swiper.emit('realIndexChange');
    }

    if (swiper.initialized || swiper.params.runCallbacksOnInit) {
      swiper.emit('slideChange');
    }
  }

  function updateClickedSlide(e) {
    const swiper = this;
    const params = swiper.params;
    const slide = $(e).closest(`.${params.slideClass}`)[0];
    let slideFound = false;
    let slideIndex;

    if (slide) {
      for (let i = 0; i < swiper.slides.length; i += 1) {
        if (swiper.slides[i] === slide) {
          slideFound = true;
          slideIndex = i;
          break;
        }
      }
    }

    if (slide && slideFound) {
      swiper.clickedSlide = slide;

      if (swiper.virtual && swiper.params.virtual.enabled) {
        swiper.clickedIndex = parseInt($(slide).attr('data-swiper-slide-index'), 10);
      } else {
        swiper.clickedIndex = slideIndex;
      }
    } else {
      swiper.clickedSlide = undefined;
      swiper.clickedIndex = undefined;
      return;
    }

    if (params.slideToClickedSlide && swiper.clickedIndex !== undefined && swiper.clickedIndex !== swiper.activeIndex) {
      swiper.slideToClickedSlide();
    }
  }

  var update = {
    updateSize,
    updateSlides,
    updateAutoHeight,
    updateSlidesOffset,
    updateSlidesProgress,
    updateProgress,
    updateSlidesClasses,
    updateActiveIndex,
    updateClickedSlide
  };

  function getSwiperTranslate(axis = this.isHorizontal() ? 'x' : 'y') {
    const swiper = this;
    const {
      params,
      rtlTranslate: rtl,
      translate,
      $wrapperEl
    } = swiper;

    if (params.virtualTranslate) {
      return rtl ? -translate : translate;
    }

    if (params.cssMode) {
      return translate;
    }

    let currentTranslate = getTranslate$1($wrapperEl[0], axis);
    if (rtl) currentTranslate = -currentTranslate;
    return currentTranslate || 0;
  }

  function setTranslate(translate, byController) {
    const swiper = this;
    const {
      rtlTranslate: rtl,
      params,
      $wrapperEl,
      wrapperEl,
      progress
    } = swiper;
    let x = 0;
    let y = 0;
    const z = 0;

    if (swiper.isHorizontal()) {
      x = rtl ? -translate : translate;
    } else {
      y = translate;
    }

    if (params.roundLengths) {
      x = Math.floor(x);
      y = Math.floor(y);
    }

    if (params.cssMode) {
      wrapperEl[swiper.isHorizontal() ? 'scrollLeft' : 'scrollTop'] = swiper.isHorizontal() ? -x : -y;
    } else if (!params.virtualTranslate) {
      $wrapperEl.transform(`translate3d(${x}px, ${y}px, ${z}px)`);
    }

    swiper.previousTranslate = swiper.translate;
    swiper.translate = swiper.isHorizontal() ? x : y; // Check if we need to update progress

    let newProgress;
    const translatesDiff = swiper.maxTranslate() - swiper.minTranslate();

    if (translatesDiff === 0) {
      newProgress = 0;
    } else {
      newProgress = (translate - swiper.minTranslate()) / translatesDiff;
    }

    if (newProgress !== progress) {
      swiper.updateProgress(translate);
    }

    swiper.emit('setTranslate', swiper.translate, byController);
  }

  function minTranslate() {
    return -this.snapGrid[0];
  }

  function maxTranslate() {
    return -this.snapGrid[this.snapGrid.length - 1];
  }

  function translateTo(translate = 0, speed = this.params.speed, runCallbacks = true, translateBounds = true, internal) {
    const swiper = this;
    const {
      params,
      wrapperEl
    } = swiper;

    if (swiper.animating && params.preventInteractionOnTransition) {
      return false;
    }

    const minTranslate = swiper.minTranslate();
    const maxTranslate = swiper.maxTranslate();
    let newTranslate;
    if (translateBounds && translate > minTranslate) newTranslate = minTranslate;else if (translateBounds && translate < maxTranslate) newTranslate = maxTranslate;else newTranslate = translate; // Update progress

    swiper.updateProgress(newTranslate);

    if (params.cssMode) {
      const isH = swiper.isHorizontal();

      if (speed === 0) {
        wrapperEl[isH ? 'scrollLeft' : 'scrollTop'] = -newTranslate;
      } else {
        if (!swiper.support.smoothScroll) {
          animateCSSModeScroll({
            swiper,
            targetPosition: -newTranslate,
            side: isH ? 'left' : 'top'
          });
          return true;
        }

        wrapperEl.scrollTo({
          [isH ? 'left' : 'top']: -newTranslate,
          behavior: 'smooth'
        });
      }

      return true;
    }

    if (speed === 0) {
      swiper.setTransition(0);
      swiper.setTranslate(newTranslate);

      if (runCallbacks) {
        swiper.emit('beforeTransitionStart', speed, internal);
        swiper.emit('transitionEnd');
      }
    } else {
      swiper.setTransition(speed);
      swiper.setTranslate(newTranslate);

      if (runCallbacks) {
        swiper.emit('beforeTransitionStart', speed, internal);
        swiper.emit('transitionStart');
      }

      if (!swiper.animating) {
        swiper.animating = true;

        if (!swiper.onTranslateToWrapperTransitionEnd) {
          swiper.onTranslateToWrapperTransitionEnd = function transitionEnd(e) {
            if (!swiper || swiper.destroyed) return;
            if (e.target !== this) return;
            swiper.$wrapperEl[0].removeEventListener('transitionend', swiper.onTranslateToWrapperTransitionEnd);
            swiper.$wrapperEl[0].removeEventListener('webkitTransitionEnd', swiper.onTranslateToWrapperTransitionEnd);
            swiper.onTranslateToWrapperTransitionEnd = null;
            delete swiper.onTranslateToWrapperTransitionEnd;

            if (runCallbacks) {
              swiper.emit('transitionEnd');
            }
          };
        }

        swiper.$wrapperEl[0].addEventListener('transitionend', swiper.onTranslateToWrapperTransitionEnd);
        swiper.$wrapperEl[0].addEventListener('webkitTransitionEnd', swiper.onTranslateToWrapperTransitionEnd);
      }
    }

    return true;
  }

  var translate = {
    getTranslate: getSwiperTranslate,
    setTranslate,
    minTranslate,
    maxTranslate,
    translateTo
  };

  function setTransition(duration, byController) {
    const swiper = this;

    if (!swiper.params.cssMode) {
      swiper.$wrapperEl.transition(duration);
    }

    swiper.emit('setTransition', duration, byController);
  }

  function transitionEmit({
    swiper,
    runCallbacks,
    direction,
    step
  }) {
    const {
      activeIndex,
      previousIndex
    } = swiper;
    let dir = direction;

    if (!dir) {
      if (activeIndex > previousIndex) dir = 'next';else if (activeIndex < previousIndex) dir = 'prev';else dir = 'reset';
    }

    swiper.emit(`transition${step}`);

    if (runCallbacks && activeIndex !== previousIndex) {
      if (dir === 'reset') {
        swiper.emit(`slideResetTransition${step}`);
        return;
      }

      swiper.emit(`slideChangeTransition${step}`);

      if (dir === 'next') {
        swiper.emit(`slideNextTransition${step}`);
      } else {
        swiper.emit(`slidePrevTransition${step}`);
      }
    }
  }

  function transitionStart(runCallbacks = true, direction) {
    const swiper = this;
    const {
      params
    } = swiper;
    if (params.cssMode) return;

    if (params.autoHeight) {
      swiper.updateAutoHeight();
    }

    transitionEmit({
      swiper,
      runCallbacks,
      direction,
      step: 'Start'
    });
  }

  function transitionEnd$1(runCallbacks = true, direction) {
    const swiper = this;
    const {
      params
    } = swiper;
    swiper.animating = false;
    if (params.cssMode) return;
    swiper.setTransition(0);
    transitionEmit({
      swiper,
      runCallbacks,
      direction,
      step: 'End'
    });
  }

  var transition$1 = {
    setTransition,
    transitionStart,
    transitionEnd: transitionEnd$1
  };

  function slideTo(index = 0, speed = this.params.speed, runCallbacks = true, internal, initial) {
    if (typeof index !== 'number' && typeof index !== 'string') {
      throw new Error(`The 'index' argument cannot have type other than 'number' or 'string'. [${typeof index}] given.`);
    }

    if (typeof index === 'string') {
      /**
       * The `index` argument converted from `string` to `number`.
       * @type {number}
       */
      const indexAsNumber = parseInt(index, 10);
      /**
       * Determines whether the `index` argument is a valid `number`
       * after being converted from the `string` type.
       * @type {boolean}
       */

      const isValidNumber = isFinite(indexAsNumber);

      if (!isValidNumber) {
        throw new Error(`The passed-in 'index' (string) couldn't be converted to 'number'. [${index}] given.`);
      } // Knowing that the converted `index` is a valid number,
      // we can update the original argument's value.


      index = indexAsNumber;
    }

    const swiper = this;
    let slideIndex = index;
    if (slideIndex < 0) slideIndex = 0;
    const {
      params,
      snapGrid,
      slidesGrid,
      previousIndex,
      activeIndex,
      rtlTranslate: rtl,
      wrapperEl,
      enabled
    } = swiper;

    if (swiper.animating && params.preventInteractionOnTransition || !enabled && !internal && !initial) {
      return false;
    }

    const skip = Math.min(swiper.params.slidesPerGroupSkip, slideIndex);
    let snapIndex = skip + Math.floor((slideIndex - skip) / swiper.params.slidesPerGroup);
    if (snapIndex >= snapGrid.length) snapIndex = snapGrid.length - 1;
    const translate = -snapGrid[snapIndex]; // Normalize slideIndex

    if (params.normalizeSlideIndex) {
      for (let i = 0; i < slidesGrid.length; i += 1) {
        const normalizedTranslate = -Math.floor(translate * 100);
        const normalizedGrid = Math.floor(slidesGrid[i] * 100);
        const normalizedGridNext = Math.floor(slidesGrid[i + 1] * 100);

        if (typeof slidesGrid[i + 1] !== 'undefined') {
          if (normalizedTranslate >= normalizedGrid && normalizedTranslate < normalizedGridNext - (normalizedGridNext - normalizedGrid) / 2) {
            slideIndex = i;
          } else if (normalizedTranslate >= normalizedGrid && normalizedTranslate < normalizedGridNext) {
            slideIndex = i + 1;
          }
        } else if (normalizedTranslate >= normalizedGrid) {
          slideIndex = i;
        }
      }
    } // Directions locks


    if (swiper.initialized && slideIndex !== activeIndex) {
      if (!swiper.allowSlideNext && translate < swiper.translate && translate < swiper.minTranslate()) {
        return false;
      }

      if (!swiper.allowSlidePrev && translate > swiper.translate && translate > swiper.maxTranslate()) {
        if ((activeIndex || 0) !== slideIndex) return false;
      }
    }

    if (slideIndex !== (previousIndex || 0) && runCallbacks) {
      swiper.emit('beforeSlideChangeStart');
    } // Update progress


    swiper.updateProgress(translate);
    let direction;
    if (slideIndex > activeIndex) direction = 'next';else if (slideIndex < activeIndex) direction = 'prev';else direction = 'reset'; // Update Index

    if (rtl && -translate === swiper.translate || !rtl && translate === swiper.translate) {
      swiper.updateActiveIndex(slideIndex); // Update Height

      if (params.autoHeight) {
        swiper.updateAutoHeight();
      }

      swiper.updateSlidesClasses();

      if (params.effect !== 'slide') {
        swiper.setTranslate(translate);
      }

      if (direction !== 'reset') {
        swiper.transitionStart(runCallbacks, direction);
        swiper.transitionEnd(runCallbacks, direction);
      }

      return false;
    }

    if (params.cssMode) {
      const isH = swiper.isHorizontal();
      const t = rtl ? translate : -translate;

      if (speed === 0) {
        const isVirtual = swiper.virtual && swiper.params.virtual.enabled;

        if (isVirtual) {
          swiper.wrapperEl.style.scrollSnapType = 'none';
          swiper._immediateVirtual = true;
        }

        wrapperEl[isH ? 'scrollLeft' : 'scrollTop'] = t;

        if (isVirtual) {
          requestAnimationFrame(() => {
            swiper.wrapperEl.style.scrollSnapType = '';
            swiper._swiperImmediateVirtual = false;
          });
        }
      } else {
        if (!swiper.support.smoothScroll) {
          animateCSSModeScroll({
            swiper,
            targetPosition: t,
            side: isH ? 'left' : 'top'
          });
          return true;
        }

        wrapperEl.scrollTo({
          [isH ? 'left' : 'top']: t,
          behavior: 'smooth'
        });
      }

      return true;
    }

    swiper.setTransition(speed);
    swiper.setTranslate(translate);
    swiper.updateActiveIndex(slideIndex);
    swiper.updateSlidesClasses();
    swiper.emit('beforeTransitionStart', speed, internal);
    swiper.transitionStart(runCallbacks, direction);

    if (speed === 0) {
      swiper.transitionEnd(runCallbacks, direction);
    } else if (!swiper.animating) {
      swiper.animating = true;

      if (!swiper.onSlideToWrapperTransitionEnd) {
        swiper.onSlideToWrapperTransitionEnd = function transitionEnd(e) {
          if (!swiper || swiper.destroyed) return;
          if (e.target !== this) return;
          swiper.$wrapperEl[0].removeEventListener('transitionend', swiper.onSlideToWrapperTransitionEnd);
          swiper.$wrapperEl[0].removeEventListener('webkitTransitionEnd', swiper.onSlideToWrapperTransitionEnd);
          swiper.onSlideToWrapperTransitionEnd = null;
          delete swiper.onSlideToWrapperTransitionEnd;
          swiper.transitionEnd(runCallbacks, direction);
        };
      }

      swiper.$wrapperEl[0].addEventListener('transitionend', swiper.onSlideToWrapperTransitionEnd);
      swiper.$wrapperEl[0].addEventListener('webkitTransitionEnd', swiper.onSlideToWrapperTransitionEnd);
    }

    return true;
  }

  function slideToLoop(index = 0, speed = this.params.speed, runCallbacks = true, internal) {
    if (typeof index === 'string') {
      /**
       * The `index` argument converted from `string` to `number`.
       * @type {number}
       */
      const indexAsNumber = parseInt(index, 10);
      /**
       * Determines whether the `index` argument is a valid `number`
       * after being converted from the `string` type.
       * @type {boolean}
       */

      const isValidNumber = isFinite(indexAsNumber);

      if (!isValidNumber) {
        throw new Error(`The passed-in 'index' (string) couldn't be converted to 'number'. [${index}] given.`);
      } // Knowing that the converted `index` is a valid number,
      // we can update the original argument's value.


      index = indexAsNumber;
    }

    const swiper = this;
    let newIndex = index;

    if (swiper.params.loop) {
      newIndex += swiper.loopedSlides;
    }

    return swiper.slideTo(newIndex, speed, runCallbacks, internal);
  }

  /* eslint no-unused-vars: "off" */
  function slideNext(speed = this.params.speed, runCallbacks = true, internal) {
    const swiper = this;
    const {
      animating,
      enabled,
      params
    } = swiper;
    if (!enabled) return swiper;
    let perGroup = params.slidesPerGroup;

    if (params.slidesPerView === 'auto' && params.slidesPerGroup === 1 && params.slidesPerGroupAuto) {
      perGroup = Math.max(swiper.slidesPerViewDynamic('current', true), 1);
    }

    const increment = swiper.activeIndex < params.slidesPerGroupSkip ? 1 : perGroup;

    if (params.loop) {
      if (animating && params.loopPreventsSlide) return false;
      swiper.loopFix(); // eslint-disable-next-line

      swiper._clientLeft = swiper.$wrapperEl[0].clientLeft;
    }

    if (params.rewind && swiper.isEnd) {
      return swiper.slideTo(0, speed, runCallbacks, internal);
    }

    return swiper.slideTo(swiper.activeIndex + increment, speed, runCallbacks, internal);
  }

  /* eslint no-unused-vars: "off" */
  function slidePrev(speed = this.params.speed, runCallbacks = true, internal) {
    const swiper = this;
    const {
      params,
      animating,
      snapGrid,
      slidesGrid,
      rtlTranslate,
      enabled
    } = swiper;
    if (!enabled) return swiper;

    if (params.loop) {
      if (animating && params.loopPreventsSlide) return false;
      swiper.loopFix(); // eslint-disable-next-line

      swiper._clientLeft = swiper.$wrapperEl[0].clientLeft;
    }

    const translate = rtlTranslate ? swiper.translate : -swiper.translate;

    function normalize(val) {
      if (val < 0) return -Math.floor(Math.abs(val));
      return Math.floor(val);
    }

    const normalizedTranslate = normalize(translate);
    const normalizedSnapGrid = snapGrid.map(val => normalize(val));
    let prevSnap = snapGrid[normalizedSnapGrid.indexOf(normalizedTranslate) - 1];

    if (typeof prevSnap === 'undefined' && params.cssMode) {
      let prevSnapIndex;
      snapGrid.forEach((snap, snapIndex) => {
        if (normalizedTranslate >= snap) {
          // prevSnap = snap;
          prevSnapIndex = snapIndex;
        }
      });

      if (typeof prevSnapIndex !== 'undefined') {
        prevSnap = snapGrid[prevSnapIndex > 0 ? prevSnapIndex - 1 : prevSnapIndex];
      }
    }

    let prevIndex = 0;

    if (typeof prevSnap !== 'undefined') {
      prevIndex = slidesGrid.indexOf(prevSnap);
      if (prevIndex < 0) prevIndex = swiper.activeIndex - 1;

      if (params.slidesPerView === 'auto' && params.slidesPerGroup === 1 && params.slidesPerGroupAuto) {
        prevIndex = prevIndex - swiper.slidesPerViewDynamic('previous', true) + 1;
        prevIndex = Math.max(prevIndex, 0);
      }
    }

    if (params.rewind && swiper.isBeginning) {
      const lastIndex = swiper.params.virtual && swiper.params.virtual.enabled && swiper.virtual ? swiper.virtual.slides.length - 1 : swiper.slides.length - 1;
      return swiper.slideTo(lastIndex, speed, runCallbacks, internal);
    }

    return swiper.slideTo(prevIndex, speed, runCallbacks, internal);
  }

  /* eslint no-unused-vars: "off" */
  function slideReset(speed = this.params.speed, runCallbacks = true, internal) {
    const swiper = this;
    return swiper.slideTo(swiper.activeIndex, speed, runCallbacks, internal);
  }

  /* eslint no-unused-vars: "off" */
  function slideToClosest(speed = this.params.speed, runCallbacks = true, internal, threshold = 0.5) {
    const swiper = this;
    let index = swiper.activeIndex;
    const skip = Math.min(swiper.params.slidesPerGroupSkip, index);
    const snapIndex = skip + Math.floor((index - skip) / swiper.params.slidesPerGroup);
    const translate = swiper.rtlTranslate ? swiper.translate : -swiper.translate;

    if (translate >= swiper.snapGrid[snapIndex]) {
      // The current translate is on or after the current snap index, so the choice
      // is between the current index and the one after it.
      const currentSnap = swiper.snapGrid[snapIndex];
      const nextSnap = swiper.snapGrid[snapIndex + 1];

      if (translate - currentSnap > (nextSnap - currentSnap) * threshold) {
        index += swiper.params.slidesPerGroup;
      }
    } else {
      // The current translate is before the current snap index, so the choice
      // is between the current index and the one before it.
      const prevSnap = swiper.snapGrid[snapIndex - 1];
      const currentSnap = swiper.snapGrid[snapIndex];

      if (translate - prevSnap <= (currentSnap - prevSnap) * threshold) {
        index -= swiper.params.slidesPerGroup;
      }
    }

    index = Math.max(index, 0);
    index = Math.min(index, swiper.slidesGrid.length - 1);
    return swiper.slideTo(index, speed, runCallbacks, internal);
  }

  function slideToClickedSlide() {
    const swiper = this;
    const {
      params,
      $wrapperEl
    } = swiper;
    const slidesPerView = params.slidesPerView === 'auto' ? swiper.slidesPerViewDynamic() : params.slidesPerView;
    let slideToIndex = swiper.clickedIndex;
    let realIndex;

    if (params.loop) {
      if (swiper.animating) return;
      realIndex = parseInt($(swiper.clickedSlide).attr('data-swiper-slide-index'), 10);

      if (params.centeredSlides) {
        if (slideToIndex < swiper.loopedSlides - slidesPerView / 2 || slideToIndex > swiper.slides.length - swiper.loopedSlides + slidesPerView / 2) {
          swiper.loopFix();
          slideToIndex = $wrapperEl.children(`.${params.slideClass}[data-swiper-slide-index="${realIndex}"]:not(.${params.slideDuplicateClass})`).eq(0).index();
          nextTick(() => {
            swiper.slideTo(slideToIndex);
          });
        } else {
          swiper.slideTo(slideToIndex);
        }
      } else if (slideToIndex > swiper.slides.length - slidesPerView) {
        swiper.loopFix();
        slideToIndex = $wrapperEl.children(`.${params.slideClass}[data-swiper-slide-index="${realIndex}"]:not(.${params.slideDuplicateClass})`).eq(0).index();
        nextTick(() => {
          swiper.slideTo(slideToIndex);
        });
      } else {
        swiper.slideTo(slideToIndex);
      }
    } else {
      swiper.slideTo(slideToIndex);
    }
  }

  var slide = {
    slideTo,
    slideToLoop,
    slideNext,
    slidePrev,
    slideReset,
    slideToClosest,
    slideToClickedSlide
  };

  function loopCreate() {
    const swiper = this;
    const document = getDocument();
    const {
      params,
      $wrapperEl
    } = swiper; // Remove duplicated slides

    const $selector = $wrapperEl.children().length > 0 ? $($wrapperEl.children()[0].parentNode) : $wrapperEl;
    $selector.children(`.${params.slideClass}.${params.slideDuplicateClass}`).remove();
    let slides = $selector.children(`.${params.slideClass}`);

    if (params.loopFillGroupWithBlank) {
      const blankSlidesNum = params.slidesPerGroup - slides.length % params.slidesPerGroup;

      if (blankSlidesNum !== params.slidesPerGroup) {
        for (let i = 0; i < blankSlidesNum; i += 1) {
          const blankNode = $(document.createElement('div')).addClass(`${params.slideClass} ${params.slideBlankClass}`);
          $selector.append(blankNode);
        }

        slides = $selector.children(`.${params.slideClass}`);
      }
    }

    if (params.slidesPerView === 'auto' && !params.loopedSlides) params.loopedSlides = slides.length;
    swiper.loopedSlides = Math.ceil(parseFloat(params.loopedSlides || params.slidesPerView, 10));
    swiper.loopedSlides += params.loopAdditionalSlides;

    if (swiper.loopedSlides > slides.length && swiper.params.loopedSlidesLimit) {
      swiper.loopedSlides = slides.length;
    }

    const prependSlides = [];
    const appendSlides = [];
    slides.each((el, index) => {
      const slide = $(el);
      slide.attr('data-swiper-slide-index', index);
    });

    for (let i = 0; i < swiper.loopedSlides; i += 1) {
      const index = i - Math.floor(i / slides.length) * slides.length;
      appendSlides.push(slides.eq(index)[0]);
      prependSlides.unshift(slides.eq(slides.length - index - 1)[0]);
    }

    for (let i = 0; i < appendSlides.length; i += 1) {
      $selector.append($(appendSlides[i].cloneNode(true)).addClass(params.slideDuplicateClass));
    }

    for (let i = prependSlides.length - 1; i >= 0; i -= 1) {
      $selector.prepend($(prependSlides[i].cloneNode(true)).addClass(params.slideDuplicateClass));
    }
  }

  function loopFix() {
    const swiper = this;
    swiper.emit('beforeLoopFix');
    const {
      activeIndex,
      slides,
      loopedSlides,
      allowSlidePrev,
      allowSlideNext,
      snapGrid,
      rtlTranslate: rtl
    } = swiper;
    let newIndex;
    swiper.allowSlidePrev = true;
    swiper.allowSlideNext = true;
    const snapTranslate = -snapGrid[activeIndex];
    const diff = snapTranslate - swiper.getTranslate(); // Fix For Negative Oversliding

    if (activeIndex < loopedSlides) {
      newIndex = slides.length - loopedSlides * 3 + activeIndex;
      newIndex += loopedSlides;
      const slideChanged = swiper.slideTo(newIndex, 0, false, true);

      if (slideChanged && diff !== 0) {
        swiper.setTranslate((rtl ? -swiper.translate : swiper.translate) - diff);
      }
    } else if (activeIndex >= slides.length - loopedSlides) {
      // Fix For Positive Oversliding
      newIndex = -slides.length + activeIndex + loopedSlides;
      newIndex += loopedSlides;
      const slideChanged = swiper.slideTo(newIndex, 0, false, true);

      if (slideChanged && diff !== 0) {
        swiper.setTranslate((rtl ? -swiper.translate : swiper.translate) - diff);
      }
    }

    swiper.allowSlidePrev = allowSlidePrev;
    swiper.allowSlideNext = allowSlideNext;
    swiper.emit('loopFix');
  }

  function loopDestroy() {
    const swiper = this;
    const {
      $wrapperEl,
      params,
      slides
    } = swiper;
    $wrapperEl.children(`.${params.slideClass}.${params.slideDuplicateClass},.${params.slideClass}.${params.slideBlankClass}`).remove();
    slides.removeAttr('data-swiper-slide-index');
  }

  var loop = {
    loopCreate,
    loopFix,
    loopDestroy
  };

  function setGrabCursor(moving) {
    const swiper = this;
    if (swiper.support.touch || !swiper.params.simulateTouch || swiper.params.watchOverflow && swiper.isLocked || swiper.params.cssMode) return;
    const el = swiper.params.touchEventsTarget === 'container' ? swiper.el : swiper.wrapperEl;
    el.style.cursor = 'move';
    el.style.cursor = moving ? 'grabbing' : 'grab';
  }

  function unsetGrabCursor() {
    const swiper = this;

    if (swiper.support.touch || swiper.params.watchOverflow && swiper.isLocked || swiper.params.cssMode) {
      return;
    }

    swiper[swiper.params.touchEventsTarget === 'container' ? 'el' : 'wrapperEl'].style.cursor = '';
  }

  var grabCursor = {
    setGrabCursor,
    unsetGrabCursor
  };

  function closestElement(selector, base = this) {
    function __closestFrom(el) {
      if (!el || el === getDocument() || el === getWindow()) return null;
      if (el.assignedSlot) el = el.assignedSlot;
      const found = el.closest(selector);

      if (!found && !el.getRootNode) {
        return null;
      }

      return found || __closestFrom(el.getRootNode().host);
    }

    return __closestFrom(base);
  }

  function onTouchStart(event) {
    const swiper = this;
    const document = getDocument();
    const window = getWindow();
    const data = swiper.touchEventsData;
    const {
      params,
      touches,
      enabled
    } = swiper;
    if (!enabled) return;

    if (swiper.animating && params.preventInteractionOnTransition) {
      return;
    }

    if (!swiper.animating && params.cssMode && params.loop) {
      swiper.loopFix();
    }

    let e = event;
    if (e.originalEvent) e = e.originalEvent;
    let $targetEl = $(e.target);

    if (params.touchEventsTarget === 'wrapper') {
      if (!$targetEl.closest(swiper.wrapperEl).length) return;
    }

    data.isTouchEvent = e.type === 'touchstart';
    if (!data.isTouchEvent && 'which' in e && e.which === 3) return;
    if (!data.isTouchEvent && 'button' in e && e.button > 0) return;
    if (data.isTouched && data.isMoved) return; // change target el for shadow root component

    const swipingClassHasValue = !!params.noSwipingClass && params.noSwipingClass !== ''; // eslint-disable-next-line

    const eventPath = event.composedPath ? event.composedPath() : event.path;

    if (swipingClassHasValue && e.target && e.target.shadowRoot && eventPath) {
      $targetEl = $(eventPath[0]);
    }

    const noSwipingSelector = params.noSwipingSelector ? params.noSwipingSelector : `.${params.noSwipingClass}`;
    const isTargetShadow = !!(e.target && e.target.shadowRoot); // use closestElement for shadow root element to get the actual closest for nested shadow root element

    if (params.noSwiping && (isTargetShadow ? closestElement(noSwipingSelector, $targetEl[0]) : $targetEl.closest(noSwipingSelector)[0])) {
      swiper.allowClick = true;
      return;
    }

    if (params.swipeHandler) {
      if (!$targetEl.closest(params.swipeHandler)[0]) return;
    }

    touches.currentX = e.type === 'touchstart' ? e.targetTouches[0].pageX : e.pageX;
    touches.currentY = e.type === 'touchstart' ? e.targetTouches[0].pageY : e.pageY;
    const startX = touches.currentX;
    const startY = touches.currentY; // Do NOT start if iOS edge swipe is detected. Otherwise iOS app cannot swipe-to-go-back anymore

    const edgeSwipeDetection = params.edgeSwipeDetection || params.iOSEdgeSwipeDetection;
    const edgeSwipeThreshold = params.edgeSwipeThreshold || params.iOSEdgeSwipeThreshold;

    if (edgeSwipeDetection && (startX <= edgeSwipeThreshold || startX >= window.innerWidth - edgeSwipeThreshold)) {
      if (edgeSwipeDetection === 'prevent') {
        event.preventDefault();
      } else {
        return;
      }
    }

    Object.assign(data, {
      isTouched: true,
      isMoved: false,
      allowTouchCallbacks: true,
      isScrolling: undefined,
      startMoving: undefined
    });
    touches.startX = startX;
    touches.startY = startY;
    data.touchStartTime = now$2();
    swiper.allowClick = true;
    swiper.updateSize();
    swiper.swipeDirection = undefined;
    if (params.threshold > 0) data.allowThresholdMove = false;

    if (e.type !== 'touchstart') {
      let preventDefault = true;

      if ($targetEl.is(data.focusableElements)) {
        preventDefault = false;

        if ($targetEl[0].nodeName === 'SELECT') {
          data.isTouched = false;
        }
      }

      if (document.activeElement && $(document.activeElement).is(data.focusableElements) && document.activeElement !== $targetEl[0]) {
        document.activeElement.blur();
      }

      const shouldPreventDefault = preventDefault && swiper.allowTouchMove && params.touchStartPreventDefault;

      if ((params.touchStartForcePreventDefault || shouldPreventDefault) && !$targetEl[0].isContentEditable) {
        e.preventDefault();
      }
    }

    if (swiper.params.freeMode && swiper.params.freeMode.enabled && swiper.freeMode && swiper.animating && !params.cssMode) {
      swiper.freeMode.onTouchStart();
    }

    swiper.emit('touchStart', e);
  }

  function onTouchMove(event) {
    const document = getDocument();
    const swiper = this;
    const data = swiper.touchEventsData;
    const {
      params,
      touches,
      rtlTranslate: rtl,
      enabled
    } = swiper;
    if (!enabled) return;
    let e = event;
    if (e.originalEvent) e = e.originalEvent;

    if (!data.isTouched) {
      if (data.startMoving && data.isScrolling) {
        swiper.emit('touchMoveOpposite', e);
      }

      return;
    }

    if (data.isTouchEvent && e.type !== 'touchmove') return;
    const targetTouch = e.type === 'touchmove' && e.targetTouches && (e.targetTouches[0] || e.changedTouches[0]);
    const pageX = e.type === 'touchmove' ? targetTouch.pageX : e.pageX;
    const pageY = e.type === 'touchmove' ? targetTouch.pageY : e.pageY;

    if (e.preventedByNestedSwiper) {
      touches.startX = pageX;
      touches.startY = pageY;
      return;
    }

    if (!swiper.allowTouchMove) {
      if (!$(e.target).is(data.focusableElements)) {
        swiper.allowClick = false;
      }

      if (data.isTouched) {
        Object.assign(touches, {
          startX: pageX,
          startY: pageY,
          currentX: pageX,
          currentY: pageY
        });
        data.touchStartTime = now$2();
      }

      return;
    }

    if (data.isTouchEvent && params.touchReleaseOnEdges && !params.loop) {
      if (swiper.isVertical()) {
        // Vertical
        if (pageY < touches.startY && swiper.translate <= swiper.maxTranslate() || pageY > touches.startY && swiper.translate >= swiper.minTranslate()) {
          data.isTouched = false;
          data.isMoved = false;
          return;
        }
      } else if (pageX < touches.startX && swiper.translate <= swiper.maxTranslate() || pageX > touches.startX && swiper.translate >= swiper.minTranslate()) {
        return;
      }
    }

    if (data.isTouchEvent && document.activeElement) {
      if (e.target === document.activeElement && $(e.target).is(data.focusableElements)) {
        data.isMoved = true;
        swiper.allowClick = false;
        return;
      }
    }

    if (data.allowTouchCallbacks) {
      swiper.emit('touchMove', e);
    }

    if (e.targetTouches && e.targetTouches.length > 1) return;
    touches.currentX = pageX;
    touches.currentY = pageY;
    const diffX = touches.currentX - touches.startX;
    const diffY = touches.currentY - touches.startY;
    if (swiper.params.threshold && Math.sqrt(diffX ** 2 + diffY ** 2) < swiper.params.threshold) return;

    if (typeof data.isScrolling === 'undefined') {
      let touchAngle;

      if (swiper.isHorizontal() && touches.currentY === touches.startY || swiper.isVertical() && touches.currentX === touches.startX) {
        data.isScrolling = false;
      } else {
        // eslint-disable-next-line
        if (diffX * diffX + diffY * diffY >= 25) {
          touchAngle = Math.atan2(Math.abs(diffY), Math.abs(diffX)) * 180 / Math.PI;
          data.isScrolling = swiper.isHorizontal() ? touchAngle > params.touchAngle : 90 - touchAngle > params.touchAngle;
        }
      }
    }

    if (data.isScrolling) {
      swiper.emit('touchMoveOpposite', e);
    }

    if (typeof data.startMoving === 'undefined') {
      if (touches.currentX !== touches.startX || touches.currentY !== touches.startY) {
        data.startMoving = true;
      }
    }

    if (data.isScrolling) {
      data.isTouched = false;
      return;
    }

    if (!data.startMoving) {
      return;
    }

    swiper.allowClick = false;

    if (!params.cssMode && e.cancelable) {
      e.preventDefault();
    }

    if (params.touchMoveStopPropagation && !params.nested) {
      e.stopPropagation();
    }

    if (!data.isMoved) {
      if (params.loop && !params.cssMode) {
        swiper.loopFix();
      }

      data.startTranslate = swiper.getTranslate();
      swiper.setTransition(0);

      if (swiper.animating) {
        swiper.$wrapperEl.trigger('webkitTransitionEnd transitionend');
      }

      data.allowMomentumBounce = false; // Grab Cursor

      if (params.grabCursor && (swiper.allowSlideNext === true || swiper.allowSlidePrev === true)) {
        swiper.setGrabCursor(true);
      }

      swiper.emit('sliderFirstMove', e);
    }

    swiper.emit('sliderMove', e);
    data.isMoved = true;
    let diff = swiper.isHorizontal() ? diffX : diffY;
    touches.diff = diff;
    diff *= params.touchRatio;
    if (rtl) diff = -diff;
    swiper.swipeDirection = diff > 0 ? 'prev' : 'next';
    data.currentTranslate = diff + data.startTranslate;
    let disableParentSwiper = true;
    let resistanceRatio = params.resistanceRatio;

    if (params.touchReleaseOnEdges) {
      resistanceRatio = 0;
    }

    if (diff > 0 && data.currentTranslate > swiper.minTranslate()) {
      disableParentSwiper = false;
      if (params.resistance) data.currentTranslate = swiper.minTranslate() - 1 + (-swiper.minTranslate() + data.startTranslate + diff) ** resistanceRatio;
    } else if (diff < 0 && data.currentTranslate < swiper.maxTranslate()) {
      disableParentSwiper = false;
      if (params.resistance) data.currentTranslate = swiper.maxTranslate() + 1 - (swiper.maxTranslate() - data.startTranslate - diff) ** resistanceRatio;
    }

    if (disableParentSwiper) {
      e.preventedByNestedSwiper = true;
    } // Directions locks


    if (!swiper.allowSlideNext && swiper.swipeDirection === 'next' && data.currentTranslate < data.startTranslate) {
      data.currentTranslate = data.startTranslate;
    }

    if (!swiper.allowSlidePrev && swiper.swipeDirection === 'prev' && data.currentTranslate > data.startTranslate) {
      data.currentTranslate = data.startTranslate;
    }

    if (!swiper.allowSlidePrev && !swiper.allowSlideNext) {
      data.currentTranslate = data.startTranslate;
    } // Threshold


    if (params.threshold > 0) {
      if (Math.abs(diff) > params.threshold || data.allowThresholdMove) {
        if (!data.allowThresholdMove) {
          data.allowThresholdMove = true;
          touches.startX = touches.currentX;
          touches.startY = touches.currentY;
          data.currentTranslate = data.startTranslate;
          touches.diff = swiper.isHorizontal() ? touches.currentX - touches.startX : touches.currentY - touches.startY;
          return;
        }
      } else {
        data.currentTranslate = data.startTranslate;
        return;
      }
    }

    if (!params.followFinger || params.cssMode) return; // Update active index in free mode

    if (params.freeMode && params.freeMode.enabled && swiper.freeMode || params.watchSlidesProgress) {
      swiper.updateActiveIndex();
      swiper.updateSlidesClasses();
    }

    if (swiper.params.freeMode && params.freeMode.enabled && swiper.freeMode) {
      swiper.freeMode.onTouchMove();
    } // Update progress


    swiper.updateProgress(data.currentTranslate); // Update translate

    swiper.setTranslate(data.currentTranslate);
  }

  function onTouchEnd(event) {
    const swiper = this;
    const data = swiper.touchEventsData;
    const {
      params,
      touches,
      rtlTranslate: rtl,
      slidesGrid,
      enabled
    } = swiper;
    if (!enabled) return;
    let e = event;
    if (e.originalEvent) e = e.originalEvent;

    if (data.allowTouchCallbacks) {
      swiper.emit('touchEnd', e);
    }

    data.allowTouchCallbacks = false;

    if (!data.isTouched) {
      if (data.isMoved && params.grabCursor) {
        swiper.setGrabCursor(false);
      }

      data.isMoved = false;
      data.startMoving = false;
      return;
    } // Return Grab Cursor


    if (params.grabCursor && data.isMoved && data.isTouched && (swiper.allowSlideNext === true || swiper.allowSlidePrev === true)) {
      swiper.setGrabCursor(false);
    } // Time diff


    const touchEndTime = now$2();
    const timeDiff = touchEndTime - data.touchStartTime; // Tap, doubleTap, Click

    if (swiper.allowClick) {
      const pathTree = e.path || e.composedPath && e.composedPath();
      swiper.updateClickedSlide(pathTree && pathTree[0] || e.target);
      swiper.emit('tap click', e);

      if (timeDiff < 300 && touchEndTime - data.lastClickTime < 300) {
        swiper.emit('doubleTap doubleClick', e);
      }
    }

    data.lastClickTime = now$2();
    nextTick(() => {
      if (!swiper.destroyed) swiper.allowClick = true;
    });

    if (!data.isTouched || !data.isMoved || !swiper.swipeDirection || touches.diff === 0 || data.currentTranslate === data.startTranslate) {
      data.isTouched = false;
      data.isMoved = false;
      data.startMoving = false;
      return;
    }

    data.isTouched = false;
    data.isMoved = false;
    data.startMoving = false;
    let currentPos;

    if (params.followFinger) {
      currentPos = rtl ? swiper.translate : -swiper.translate;
    } else {
      currentPos = -data.currentTranslate;
    }

    if (params.cssMode) {
      return;
    }

    if (swiper.params.freeMode && params.freeMode.enabled) {
      swiper.freeMode.onTouchEnd({
        currentPos
      });
      return;
    } // Find current slide


    let stopIndex = 0;
    let groupSize = swiper.slidesSizesGrid[0];

    for (let i = 0; i < slidesGrid.length; i += i < params.slidesPerGroupSkip ? 1 : params.slidesPerGroup) {
      const increment = i < params.slidesPerGroupSkip - 1 ? 1 : params.slidesPerGroup;

      if (typeof slidesGrid[i + increment] !== 'undefined') {
        if (currentPos >= slidesGrid[i] && currentPos < slidesGrid[i + increment]) {
          stopIndex = i;
          groupSize = slidesGrid[i + increment] - slidesGrid[i];
        }
      } else if (currentPos >= slidesGrid[i]) {
        stopIndex = i;
        groupSize = slidesGrid[slidesGrid.length - 1] - slidesGrid[slidesGrid.length - 2];
      }
    }

    let rewindFirstIndex = null;
    let rewindLastIndex = null;

    if (params.rewind) {
      if (swiper.isBeginning) {
        rewindLastIndex = swiper.params.virtual && swiper.params.virtual.enabled && swiper.virtual ? swiper.virtual.slides.length - 1 : swiper.slides.length - 1;
      } else if (swiper.isEnd) {
        rewindFirstIndex = 0;
      }
    } // Find current slide size


    const ratio = (currentPos - slidesGrid[stopIndex]) / groupSize;
    const increment = stopIndex < params.slidesPerGroupSkip - 1 ? 1 : params.slidesPerGroup;

    if (timeDiff > params.longSwipesMs) {
      // Long touches
      if (!params.longSwipes) {
        swiper.slideTo(swiper.activeIndex);
        return;
      }

      if (swiper.swipeDirection === 'next') {
        if (ratio >= params.longSwipesRatio) swiper.slideTo(params.rewind && swiper.isEnd ? rewindFirstIndex : stopIndex + increment);else swiper.slideTo(stopIndex);
      }

      if (swiper.swipeDirection === 'prev') {
        if (ratio > 1 - params.longSwipesRatio) {
          swiper.slideTo(stopIndex + increment);
        } else if (rewindLastIndex !== null && ratio < 0 && Math.abs(ratio) > params.longSwipesRatio) {
          swiper.slideTo(rewindLastIndex);
        } else {
          swiper.slideTo(stopIndex);
        }
      }
    } else {
      // Short swipes
      if (!params.shortSwipes) {
        swiper.slideTo(swiper.activeIndex);
        return;
      }

      const isNavButtonTarget = swiper.navigation && (e.target === swiper.navigation.nextEl || e.target === swiper.navigation.prevEl);

      if (!isNavButtonTarget) {
        if (swiper.swipeDirection === 'next') {
          swiper.slideTo(rewindFirstIndex !== null ? rewindFirstIndex : stopIndex + increment);
        }

        if (swiper.swipeDirection === 'prev') {
          swiper.slideTo(rewindLastIndex !== null ? rewindLastIndex : stopIndex);
        }
      } else if (e.target === swiper.navigation.nextEl) {
        swiper.slideTo(stopIndex + increment);
      } else {
        swiper.slideTo(stopIndex);
      }
    }
  }

  function onResize() {
    const swiper = this;
    const {
      params,
      el
    } = swiper;
    if (el && el.offsetWidth === 0) return; // Breakpoints

    if (params.breakpoints) {
      swiper.setBreakpoint();
    } // Save locks


    const {
      allowSlideNext,
      allowSlidePrev,
      snapGrid
    } = swiper; // Disable locks on resize

    swiper.allowSlideNext = true;
    swiper.allowSlidePrev = true;
    swiper.updateSize();
    swiper.updateSlides();
    swiper.updateSlidesClasses();

    if ((params.slidesPerView === 'auto' || params.slidesPerView > 1) && swiper.isEnd && !swiper.isBeginning && !swiper.params.centeredSlides) {
      swiper.slideTo(swiper.slides.length - 1, 0, false, true);
    } else {
      swiper.slideTo(swiper.activeIndex, 0, false, true);
    }

    if (swiper.autoplay && swiper.autoplay.running && swiper.autoplay.paused) {
      swiper.autoplay.run();
    } // Return locks after resize


    swiper.allowSlidePrev = allowSlidePrev;
    swiper.allowSlideNext = allowSlideNext;

    if (swiper.params.watchOverflow && snapGrid !== swiper.snapGrid) {
      swiper.checkOverflow();
    }
  }

  function onClick(e) {
    const swiper = this;
    if (!swiper.enabled) return;

    if (!swiper.allowClick) {
      if (swiper.params.preventClicks) e.preventDefault();

      if (swiper.params.preventClicksPropagation && swiper.animating) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }
  }

  function onScroll() {
    const swiper = this;
    const {
      wrapperEl,
      rtlTranslate,
      enabled
    } = swiper;
    if (!enabled) return;
    swiper.previousTranslate = swiper.translate;

    if (swiper.isHorizontal()) {
      swiper.translate = -wrapperEl.scrollLeft;
    } else {
      swiper.translate = -wrapperEl.scrollTop;
    } // eslint-disable-next-line


    if (swiper.translate === 0) swiper.translate = 0;
    swiper.updateActiveIndex();
    swiper.updateSlidesClasses();
    let newProgress;
    const translatesDiff = swiper.maxTranslate() - swiper.minTranslate();

    if (translatesDiff === 0) {
      newProgress = 0;
    } else {
      newProgress = (swiper.translate - swiper.minTranslate()) / translatesDiff;
    }

    if (newProgress !== swiper.progress) {
      swiper.updateProgress(rtlTranslate ? -swiper.translate : swiper.translate);
    }

    swiper.emit('setTranslate', swiper.translate, false);
  }

  let dummyEventAttached = false;

  function dummyEventListener() {}

  const events$1 = (swiper, method) => {
    const document = getDocument();
    const {
      params,
      touchEvents,
      el,
      wrapperEl,
      device,
      support
    } = swiper;
    const capture = !!params.nested;
    const domMethod = method === 'on' ? 'addEventListener' : 'removeEventListener';
    const swiperMethod = method; // Touch Events

    if (!support.touch) {
      el[domMethod](touchEvents.start, swiper.onTouchStart, false);
      document[domMethod](touchEvents.move, swiper.onTouchMove, capture);
      document[domMethod](touchEvents.end, swiper.onTouchEnd, false);
    } else {
      const passiveListener = touchEvents.start === 'touchstart' && support.passiveListener && params.passiveListeners ? {
        passive: true,
        capture: false
      } : false;
      el[domMethod](touchEvents.start, swiper.onTouchStart, passiveListener);
      el[domMethod](touchEvents.move, swiper.onTouchMove, support.passiveListener ? {
        passive: false,
        capture
      } : capture);
      el[domMethod](touchEvents.end, swiper.onTouchEnd, passiveListener);

      if (touchEvents.cancel) {
        el[domMethod](touchEvents.cancel, swiper.onTouchEnd, passiveListener);
      }
    } // Prevent Links Clicks


    if (params.preventClicks || params.preventClicksPropagation) {
      el[domMethod]('click', swiper.onClick, true);
    }

    if (params.cssMode) {
      wrapperEl[domMethod]('scroll', swiper.onScroll);
    } // Resize handler


    if (params.updateOnWindowResize) {
      swiper[swiperMethod](device.ios || device.android ? 'resize orientationchange observerUpdate' : 'resize observerUpdate', onResize, true);
    } else {
      swiper[swiperMethod]('observerUpdate', onResize, true);
    }
  };

  function attachEvents() {
    const swiper = this;
    const document = getDocument();
    const {
      params,
      support
    } = swiper;
    swiper.onTouchStart = onTouchStart.bind(swiper);
    swiper.onTouchMove = onTouchMove.bind(swiper);
    swiper.onTouchEnd = onTouchEnd.bind(swiper);

    if (params.cssMode) {
      swiper.onScroll = onScroll.bind(swiper);
    }

    swiper.onClick = onClick.bind(swiper);

    if (support.touch && !dummyEventAttached) {
      document.addEventListener('touchstart', dummyEventListener);
      dummyEventAttached = true;
    }

    events$1(swiper, 'on');
  }

  function detachEvents() {
    const swiper = this;
    events$1(swiper, 'off');
  }

  var events$2 = {
    attachEvents,
    detachEvents
  };

  const isGridEnabled = (swiper, params) => {
    return swiper.grid && params.grid && params.grid.rows > 1;
  };

  function setBreakpoint() {
    const swiper = this;
    const {
      activeIndex,
      initialized,
      loopedSlides = 0,
      params,
      $el
    } = swiper;
    const breakpoints = params.breakpoints;
    if (!breakpoints || breakpoints && Object.keys(breakpoints).length === 0) return; // Get breakpoint for window width and update parameters

    const breakpoint = swiper.getBreakpoint(breakpoints, swiper.params.breakpointsBase, swiper.el);
    if (!breakpoint || swiper.currentBreakpoint === breakpoint) return;
    const breakpointOnlyParams = breakpoint in breakpoints ? breakpoints[breakpoint] : undefined;
    const breakpointParams = breakpointOnlyParams || swiper.originalParams;
    const wasMultiRow = isGridEnabled(swiper, params);
    const isMultiRow = isGridEnabled(swiper, breakpointParams);
    const wasEnabled = params.enabled;

    if (wasMultiRow && !isMultiRow) {
      $el.removeClass(`${params.containerModifierClass}grid ${params.containerModifierClass}grid-column`);
      swiper.emitContainerClasses();
    } else if (!wasMultiRow && isMultiRow) {
      $el.addClass(`${params.containerModifierClass}grid`);

      if (breakpointParams.grid.fill && breakpointParams.grid.fill === 'column' || !breakpointParams.grid.fill && params.grid.fill === 'column') {
        $el.addClass(`${params.containerModifierClass}grid-column`);
      }

      swiper.emitContainerClasses();
    } // Toggle navigation, pagination, scrollbar


    ['navigation', 'pagination', 'scrollbar'].forEach(prop => {
      const wasModuleEnabled = params[prop] && params[prop].enabled;
      const isModuleEnabled = breakpointParams[prop] && breakpointParams[prop].enabled;

      if (wasModuleEnabled && !isModuleEnabled) {
        swiper[prop].disable();
      }

      if (!wasModuleEnabled && isModuleEnabled) {
        swiper[prop].enable();
      }
    });
    const directionChanged = breakpointParams.direction && breakpointParams.direction !== params.direction;
    const needsReLoop = params.loop && (breakpointParams.slidesPerView !== params.slidesPerView || directionChanged);

    if (directionChanged && initialized) {
      swiper.changeDirection();
    }

    extend$1(swiper.params, breakpointParams);
    const isEnabled = swiper.params.enabled;
    Object.assign(swiper, {
      allowTouchMove: swiper.params.allowTouchMove,
      allowSlideNext: swiper.params.allowSlideNext,
      allowSlidePrev: swiper.params.allowSlidePrev
    });

    if (wasEnabled && !isEnabled) {
      swiper.disable();
    } else if (!wasEnabled && isEnabled) {
      swiper.enable();
    }

    swiper.currentBreakpoint = breakpoint;
    swiper.emit('_beforeBreakpoint', breakpointParams);

    if (needsReLoop && initialized) {
      swiper.loopDestroy();
      swiper.loopCreate();
      swiper.updateSlides();
      swiper.slideTo(activeIndex - loopedSlides + swiper.loopedSlides, 0, false);
    }

    swiper.emit('breakpoint', breakpointParams);
  }

  function getBreakpoint(breakpoints, base = 'window', containerEl) {
    if (!breakpoints || base === 'container' && !containerEl) return undefined;
    let breakpoint = false;
    const window = getWindow();
    const currentHeight = base === 'window' ? window.innerHeight : containerEl.clientHeight;
    const points = Object.keys(breakpoints).map(point => {
      if (typeof point === 'string' && point.indexOf('@') === 0) {
        const minRatio = parseFloat(point.substr(1));
        const value = currentHeight * minRatio;
        return {
          value,
          point
        };
      }

      return {
        value: point,
        point
      };
    });
    points.sort((a, b) => parseInt(a.value, 10) - parseInt(b.value, 10));

    for (let i = 0; i < points.length; i += 1) {
      const {
        point,
        value
      } = points[i];

      if (base === 'window') {
        if (window.matchMedia(`(min-width: ${value}px)`).matches) {
          breakpoint = point;
        }
      } else if (value <= containerEl.clientWidth) {
        breakpoint = point;
      }
    }

    return breakpoint || 'max';
  }

  var breakpoints = {
    setBreakpoint,
    getBreakpoint
  };

  function prepareClasses(entries, prefix) {
    const resultClasses = [];
    entries.forEach(item => {
      if (typeof item === 'object') {
        Object.keys(item).forEach(classNames => {
          if (item[classNames]) {
            resultClasses.push(prefix + classNames);
          }
        });
      } else if (typeof item === 'string') {
        resultClasses.push(prefix + item);
      }
    });
    return resultClasses;
  }

  function addClasses() {
    const swiper = this;
    const {
      classNames,
      params,
      rtl,
      $el,
      device,
      support
    } = swiper; // prettier-ignore

    const suffixes = prepareClasses(['initialized', params.direction, {
      'pointer-events': !support.touch
    }, {
      'free-mode': swiper.params.freeMode && params.freeMode.enabled
    }, {
      'autoheight': params.autoHeight
    }, {
      'rtl': rtl
    }, {
      'grid': params.grid && params.grid.rows > 1
    }, {
      'grid-column': params.grid && params.grid.rows > 1 && params.grid.fill === 'column'
    }, {
      'android': device.android
    }, {
      'ios': device.ios
    }, {
      'css-mode': params.cssMode
    }, {
      'centered': params.cssMode && params.centeredSlides
    }, {
      'watch-progress': params.watchSlidesProgress
    }], params.containerModifierClass);
    classNames.push(...suffixes);
    $el.addClass([...classNames].join(' '));
    swiper.emitContainerClasses();
  }

  function removeClasses() {
    const swiper = this;
    const {
      $el,
      classNames
    } = swiper;
    $el.removeClass(classNames.join(' '));
    swiper.emitContainerClasses();
  }

  var classes = {
    addClasses,
    removeClasses
  };

  function loadImage(imageEl, src, srcset, sizes, checkForComplete, callback) {
    const window = getWindow();
    let image;

    function onReady() {
      if (callback) callback();
    }

    const isPicture = $(imageEl).parent('picture')[0];

    if (!isPicture && (!imageEl.complete || !checkForComplete)) {
      if (src) {
        image = new window.Image();
        image.onload = onReady;
        image.onerror = onReady;

        if (sizes) {
          image.sizes = sizes;
        }

        if (srcset) {
          image.srcset = srcset;
        }

        if (src) {
          image.src = src;
        }
      } else {
        onReady();
      }
    } else {
      // image already loaded...
      onReady();
    }
  }

  function preloadImages() {
    const swiper = this;
    swiper.imagesToLoad = swiper.$el.find('img');

    function onReady() {
      if (typeof swiper === 'undefined' || swiper === null || !swiper || swiper.destroyed) return;
      if (swiper.imagesLoaded !== undefined) swiper.imagesLoaded += 1;

      if (swiper.imagesLoaded === swiper.imagesToLoad.length) {
        if (swiper.params.updateOnImagesReady) swiper.update();
        swiper.emit('imagesReady');
      }
    }

    for (let i = 0; i < swiper.imagesToLoad.length; i += 1) {
      const imageEl = swiper.imagesToLoad[i];
      swiper.loadImage(imageEl, imageEl.currentSrc || imageEl.getAttribute('src'), imageEl.srcset || imageEl.getAttribute('srcset'), imageEl.sizes || imageEl.getAttribute('sizes'), true, onReady);
    }
  }

  var images = {
    loadImage,
    preloadImages
  };

  function checkOverflow() {
    const swiper = this;
    const {
      isLocked: wasLocked,
      params
    } = swiper;
    const {
      slidesOffsetBefore
    } = params;

    if (slidesOffsetBefore) {
      const lastSlideIndex = swiper.slides.length - 1;
      const lastSlideRightEdge = swiper.slidesGrid[lastSlideIndex] + swiper.slidesSizesGrid[lastSlideIndex] + slidesOffsetBefore * 2;
      swiper.isLocked = swiper.size > lastSlideRightEdge;
    } else {
      swiper.isLocked = swiper.snapGrid.length === 1;
    }

    if (params.allowSlideNext === true) {
      swiper.allowSlideNext = !swiper.isLocked;
    }

    if (params.allowSlidePrev === true) {
      swiper.allowSlidePrev = !swiper.isLocked;
    }

    if (wasLocked && wasLocked !== swiper.isLocked) {
      swiper.isEnd = false;
    }

    if (wasLocked !== swiper.isLocked) {
      swiper.emit(swiper.isLocked ? 'lock' : 'unlock');
    }
  }

  var checkOverflow$1 = {
    checkOverflow
  };

  var defaults$1 = {
    init: true,
    direction: 'horizontal',
    touchEventsTarget: 'wrapper',
    initialSlide: 0,
    speed: 300,
    cssMode: false,
    updateOnWindowResize: true,
    resizeObserver: true,
    nested: false,
    createElements: false,
    enabled: true,
    focusableElements: 'input, select, option, textarea, button, video, label',
    // Overrides
    width: null,
    height: null,
    //
    preventInteractionOnTransition: false,
    // ssr
    userAgent: null,
    url: null,
    // To support iOS's swipe-to-go-back gesture (when being used in-app).
    edgeSwipeDetection: false,
    edgeSwipeThreshold: 20,
    // Autoheight
    autoHeight: false,
    // Set wrapper width
    setWrapperSize: false,
    // Virtual Translate
    virtualTranslate: false,
    // Effects
    effect: 'slide',
    // 'slide' or 'fade' or 'cube' or 'coverflow' or 'flip'
    // Breakpoints
    breakpoints: undefined,
    breakpointsBase: 'window',
    // Slides grid
    spaceBetween: 0,
    slidesPerView: 1,
    slidesPerGroup: 1,
    slidesPerGroupSkip: 0,
    slidesPerGroupAuto: false,
    centeredSlides: false,
    centeredSlidesBounds: false,
    slidesOffsetBefore: 0,
    // in px
    slidesOffsetAfter: 0,
    // in px
    normalizeSlideIndex: true,
    centerInsufficientSlides: false,
    // Disable swiper and hide navigation when container not overflow
    watchOverflow: true,
    // Round length
    roundLengths: false,
    // Touches
    touchRatio: 1,
    touchAngle: 45,
    simulateTouch: true,
    shortSwipes: true,
    longSwipes: true,
    longSwipesRatio: 0.5,
    longSwipesMs: 300,
    followFinger: true,
    allowTouchMove: true,
    threshold: 0,
    touchMoveStopPropagation: false,
    touchStartPreventDefault: true,
    touchStartForcePreventDefault: false,
    touchReleaseOnEdges: false,
    // Unique Navigation Elements
    uniqueNavElements: true,
    // Resistance
    resistance: true,
    resistanceRatio: 0.85,
    // Progress
    watchSlidesProgress: false,
    // Cursor
    grabCursor: false,
    // Clicks
    preventClicks: true,
    preventClicksPropagation: true,
    slideToClickedSlide: false,
    // Images
    preloadImages: true,
    updateOnImagesReady: true,
    // loop
    loop: false,
    loopAdditionalSlides: 0,
    loopedSlides: null,
    loopedSlidesLimit: true,
    loopFillGroupWithBlank: false,
    loopPreventsSlide: true,
    // rewind
    rewind: false,
    // Swiping/no swiping
    allowSlidePrev: true,
    allowSlideNext: true,
    swipeHandler: null,
    // '.swipe-handler',
    noSwiping: true,
    noSwipingClass: 'swiper-no-swiping',
    noSwipingSelector: null,
    // Passive Listeners
    passiveListeners: true,
    maxBackfaceHiddenSlides: 10,
    // NS
    containerModifierClass: 'swiper-',
    // NEW
    slideClass: 'swiper-slide',
    slideBlankClass: 'swiper-slide-invisible-blank',
    slideActiveClass: 'swiper-slide-active',
    slideDuplicateActiveClass: 'swiper-slide-duplicate-active',
    slideVisibleClass: 'swiper-slide-visible',
    slideDuplicateClass: 'swiper-slide-duplicate',
    slideNextClass: 'swiper-slide-next',
    slideDuplicateNextClass: 'swiper-slide-duplicate-next',
    slidePrevClass: 'swiper-slide-prev',
    slideDuplicatePrevClass: 'swiper-slide-duplicate-prev',
    wrapperClass: 'swiper-wrapper',
    // Callbacks
    runCallbacksOnInit: true,
    // Internals
    _emitClasses: false
  };

  function moduleExtendParams(params, allModulesParams) {
    return function extendParams(obj = {}) {
      const moduleParamName = Object.keys(obj)[0];
      const moduleParams = obj[moduleParamName];

      if (typeof moduleParams !== 'object' || moduleParams === null) {
        extend$1(allModulesParams, obj);
        return;
      }

      if (['navigation', 'pagination', 'scrollbar'].indexOf(moduleParamName) >= 0 && params[moduleParamName] === true) {
        params[moduleParamName] = {
          auto: true
        };
      }

      if (!(moduleParamName in params && 'enabled' in moduleParams)) {
        extend$1(allModulesParams, obj);
        return;
      }

      if (params[moduleParamName] === true) {
        params[moduleParamName] = {
          enabled: true
        };
      }

      if (typeof params[moduleParamName] === 'object' && !('enabled' in params[moduleParamName])) {
        params[moduleParamName].enabled = true;
      }

      if (!params[moduleParamName]) params[moduleParamName] = {
        enabled: false
      };
      extend$1(allModulesParams, obj);
    };
  }

  /* eslint no-param-reassign: "off" */
  const prototypes = {
    eventsEmitter,
    update,
    translate,
    transition: transition$1,
    slide,
    loop,
    grabCursor,
    events: events$2,
    breakpoints,
    checkOverflow: checkOverflow$1,
    classes,
    images
  };
  const extendedDefaults = {};

  class Swiper {
    constructor(...args) {
      let el;
      let params;

      if (args.length === 1 && args[0].constructor && Object.prototype.toString.call(args[0]).slice(8, -1) === 'Object') {
        params = args[0];
      } else {
        [el, params] = args;
      }

      if (!params) params = {};
      params = extend$1({}, params);
      if (el && !params.el) params.el = el;

      if (params.el && $(params.el).length > 1) {
        const swipers = [];
        $(params.el).each(containerEl => {
          const newParams = extend$1({}, params, {
            el: containerEl
          });
          swipers.push(new Swiper(newParams));
        }); // eslint-disable-next-line no-constructor-return

        return swipers;
      } // Swiper Instance


      const swiper = this;
      swiper.__swiper__ = true;
      swiper.support = getSupport();
      swiper.device = getDevice({
        userAgent: params.userAgent
      });
      swiper.browser = getBrowser();
      swiper.eventsListeners = {};
      swiper.eventsAnyListeners = [];
      swiper.modules = [...swiper.__modules__];

      if (params.modules && Array.isArray(params.modules)) {
        swiper.modules.push(...params.modules);
      }

      const allModulesParams = {};
      swiper.modules.forEach(mod => {
        mod({
          swiper,
          extendParams: moduleExtendParams(params, allModulesParams),
          on: swiper.on.bind(swiper),
          once: swiper.once.bind(swiper),
          off: swiper.off.bind(swiper),
          emit: swiper.emit.bind(swiper)
        });
      }); // Extend defaults with modules params

      const swiperParams = extend$1({}, defaults$1, allModulesParams); // Extend defaults with passed params

      swiper.params = extend$1({}, swiperParams, extendedDefaults, params);
      swiper.originalParams = extend$1({}, swiper.params);
      swiper.passedParams = extend$1({}, params); // add event listeners

      if (swiper.params && swiper.params.on) {
        Object.keys(swiper.params.on).forEach(eventName => {
          swiper.on(eventName, swiper.params.on[eventName]);
        });
      }

      if (swiper.params && swiper.params.onAny) {
        swiper.onAny(swiper.params.onAny);
      } // Save Dom lib


      swiper.$ = $; // Extend Swiper

      Object.assign(swiper, {
        enabled: swiper.params.enabled,
        el,
        // Classes
        classNames: [],
        // Slides
        slides: $(),
        slidesGrid: [],
        snapGrid: [],
        slidesSizesGrid: [],

        // isDirection
        isHorizontal() {
          return swiper.params.direction === 'horizontal';
        },

        isVertical() {
          return swiper.params.direction === 'vertical';
        },

        // Indexes
        activeIndex: 0,
        realIndex: 0,
        //
        isBeginning: true,
        isEnd: false,
        // Props
        translate: 0,
        previousTranslate: 0,
        progress: 0,
        velocity: 0,
        animating: false,
        // Locks
        allowSlideNext: swiper.params.allowSlideNext,
        allowSlidePrev: swiper.params.allowSlidePrev,
        // Touch Events
        touchEvents: function touchEvents() {
          const touch = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
          const desktop = ['pointerdown', 'pointermove', 'pointerup'];
          swiper.touchEventsTouch = {
            start: touch[0],
            move: touch[1],
            end: touch[2],
            cancel: touch[3]
          };
          swiper.touchEventsDesktop = {
            start: desktop[0],
            move: desktop[1],
            end: desktop[2]
          };
          return swiper.support.touch || !swiper.params.simulateTouch ? swiper.touchEventsTouch : swiper.touchEventsDesktop;
        }(),
        touchEventsData: {
          isTouched: undefined,
          isMoved: undefined,
          allowTouchCallbacks: undefined,
          touchStartTime: undefined,
          isScrolling: undefined,
          currentTranslate: undefined,
          startTranslate: undefined,
          allowThresholdMove: undefined,
          // Form elements to match
          focusableElements: swiper.params.focusableElements,
          // Last click time
          lastClickTime: now$2(),
          clickTimeout: undefined,
          // Velocities
          velocities: [],
          allowMomentumBounce: undefined,
          isTouchEvent: undefined,
          startMoving: undefined
        },
        // Clicks
        allowClick: true,
        // Touches
        allowTouchMove: swiper.params.allowTouchMove,
        touches: {
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
          diff: 0
        },
        // Images
        imagesToLoad: [],
        imagesLoaded: 0
      });
      swiper.emit('_swiper'); // Init

      if (swiper.params.init) {
        swiper.init();
      } // Return app instance
      // eslint-disable-next-line no-constructor-return


      return swiper;
    }

    enable() {
      const swiper = this;
      if (swiper.enabled) return;
      swiper.enabled = true;

      if (swiper.params.grabCursor) {
        swiper.setGrabCursor();
      }

      swiper.emit('enable');
    }

    disable() {
      const swiper = this;
      if (!swiper.enabled) return;
      swiper.enabled = false;

      if (swiper.params.grabCursor) {
        swiper.unsetGrabCursor();
      }

      swiper.emit('disable');
    }

    setProgress(progress, speed) {
      const swiper = this;
      progress = Math.min(Math.max(progress, 0), 1);
      const min = swiper.minTranslate();
      const max = swiper.maxTranslate();
      const current = (max - min) * progress + min;
      swiper.translateTo(current, typeof speed === 'undefined' ? 0 : speed);
      swiper.updateActiveIndex();
      swiper.updateSlidesClasses();
    }

    emitContainerClasses() {
      const swiper = this;
      if (!swiper.params._emitClasses || !swiper.el) return;
      const cls = swiper.el.className.split(' ').filter(className => {
        return className.indexOf('swiper') === 0 || className.indexOf(swiper.params.containerModifierClass) === 0;
      });
      swiper.emit('_containerClasses', cls.join(' '));
    }

    getSlideClasses(slideEl) {
      const swiper = this;
      if (swiper.destroyed) return '';
      return slideEl.className.split(' ').filter(className => {
        return className.indexOf('swiper-slide') === 0 || className.indexOf(swiper.params.slideClass) === 0;
      }).join(' ');
    }

    emitSlidesClasses() {
      const swiper = this;
      if (!swiper.params._emitClasses || !swiper.el) return;
      const updates = [];
      swiper.slides.each(slideEl => {
        const classNames = swiper.getSlideClasses(slideEl);
        updates.push({
          slideEl,
          classNames
        });
        swiper.emit('_slideClass', slideEl, classNames);
      });
      swiper.emit('_slideClasses', updates);
    }

    slidesPerViewDynamic(view = 'current', exact = false) {
      const swiper = this;
      const {
        params,
        slides,
        slidesGrid,
        slidesSizesGrid,
        size: swiperSize,
        activeIndex
      } = swiper;
      let spv = 1;

      if (params.centeredSlides) {
        let slideSize = slides[activeIndex].swiperSlideSize;
        let breakLoop;

        for (let i = activeIndex + 1; i < slides.length; i += 1) {
          if (slides[i] && !breakLoop) {
            slideSize += slides[i].swiperSlideSize;
            spv += 1;
            if (slideSize > swiperSize) breakLoop = true;
          }
        }

        for (let i = activeIndex - 1; i >= 0; i -= 1) {
          if (slides[i] && !breakLoop) {
            slideSize += slides[i].swiperSlideSize;
            spv += 1;
            if (slideSize > swiperSize) breakLoop = true;
          }
        }
      } else {
        // eslint-disable-next-line
        if (view === 'current') {
          for (let i = activeIndex + 1; i < slides.length; i += 1) {
            const slideInView = exact ? slidesGrid[i] + slidesSizesGrid[i] - slidesGrid[activeIndex] < swiperSize : slidesGrid[i] - slidesGrid[activeIndex] < swiperSize;

            if (slideInView) {
              spv += 1;
            }
          }
        } else {
          // previous
          for (let i = activeIndex - 1; i >= 0; i -= 1) {
            const slideInView = slidesGrid[activeIndex] - slidesGrid[i] < swiperSize;

            if (slideInView) {
              spv += 1;
            }
          }
        }
      }

      return spv;
    }

    update() {
      const swiper = this;
      if (!swiper || swiper.destroyed) return;
      const {
        snapGrid,
        params
      } = swiper; // Breakpoints

      if (params.breakpoints) {
        swiper.setBreakpoint();
      }

      swiper.updateSize();
      swiper.updateSlides();
      swiper.updateProgress();
      swiper.updateSlidesClasses();

      function setTranslate() {
        const translateValue = swiper.rtlTranslate ? swiper.translate * -1 : swiper.translate;
        const newTranslate = Math.min(Math.max(translateValue, swiper.maxTranslate()), swiper.minTranslate());
        swiper.setTranslate(newTranslate);
        swiper.updateActiveIndex();
        swiper.updateSlidesClasses();
      }

      let translated;

      if (swiper.params.freeMode && swiper.params.freeMode.enabled) {
        setTranslate();

        if (swiper.params.autoHeight) {
          swiper.updateAutoHeight();
        }
      } else {
        if ((swiper.params.slidesPerView === 'auto' || swiper.params.slidesPerView > 1) && swiper.isEnd && !swiper.params.centeredSlides) {
          translated = swiper.slideTo(swiper.slides.length - 1, 0, false, true);
        } else {
          translated = swiper.slideTo(swiper.activeIndex, 0, false, true);
        }

        if (!translated) {
          setTranslate();
        }
      }

      if (params.watchOverflow && snapGrid !== swiper.snapGrid) {
        swiper.checkOverflow();
      }

      swiper.emit('update');
    }

    changeDirection(newDirection, needUpdate = true) {
      const swiper = this;
      const currentDirection = swiper.params.direction;

      if (!newDirection) {
        // eslint-disable-next-line
        newDirection = currentDirection === 'horizontal' ? 'vertical' : 'horizontal';
      }

      if (newDirection === currentDirection || newDirection !== 'horizontal' && newDirection !== 'vertical') {
        return swiper;
      }

      swiper.$el.removeClass(`${swiper.params.containerModifierClass}${currentDirection}`).addClass(`${swiper.params.containerModifierClass}${newDirection}`);
      swiper.emitContainerClasses();
      swiper.params.direction = newDirection;
      swiper.slides.each(slideEl => {
        if (newDirection === 'vertical') {
          slideEl.style.width = '';
        } else {
          slideEl.style.height = '';
        }
      });
      swiper.emit('changeDirection');
      if (needUpdate) swiper.update();
      return swiper;
    }

    changeLanguageDirection(direction) {
      const swiper = this;
      if (swiper.rtl && direction === 'rtl' || !swiper.rtl && direction === 'ltr') return;
      swiper.rtl = direction === 'rtl';
      swiper.rtlTranslate = swiper.params.direction === 'horizontal' && swiper.rtl;

      if (swiper.rtl) {
        swiper.$el.addClass(`${swiper.params.containerModifierClass}rtl`);
        swiper.el.dir = 'rtl';
      } else {
        swiper.$el.removeClass(`${swiper.params.containerModifierClass}rtl`);
        swiper.el.dir = 'ltr';
      }

      swiper.update();
    }

    mount(el) {
      const swiper = this;
      if (swiper.mounted) return true; // Find el

      const $el = $(el || swiper.params.el);
      el = $el[0];

      if (!el) {
        return false;
      }

      el.swiper = swiper;

      const getWrapperSelector = () => {
        return `.${(swiper.params.wrapperClass || '').trim().split(' ').join('.')}`;
      };

      const getWrapper = () => {
        if (el && el.shadowRoot && el.shadowRoot.querySelector) {
          const res = $(el.shadowRoot.querySelector(getWrapperSelector())); // Children needs to return slot items

          res.children = options => $el.children(options);

          return res;
        }

        if (!$el.children) {
          return $($el).children(getWrapperSelector());
        }

        return $el.children(getWrapperSelector());
      }; // Find Wrapper


      let $wrapperEl = getWrapper();

      if ($wrapperEl.length === 0 && swiper.params.createElements) {
        const document = getDocument();
        const wrapper = document.createElement('div');
        $wrapperEl = $(wrapper);
        wrapper.className = swiper.params.wrapperClass;
        $el.append(wrapper);
        $el.children(`.${swiper.params.slideClass}`).each(slideEl => {
          $wrapperEl.append(slideEl);
        });
      }

      Object.assign(swiper, {
        $el,
        el,
        $wrapperEl,
        wrapperEl: $wrapperEl[0],
        mounted: true,
        // RTL
        rtl: el.dir.toLowerCase() === 'rtl' || $el.css('direction') === 'rtl',
        rtlTranslate: swiper.params.direction === 'horizontal' && (el.dir.toLowerCase() === 'rtl' || $el.css('direction') === 'rtl'),
        wrongRTL: $wrapperEl.css('display') === '-webkit-box'
      });
      return true;
    }

    init(el) {
      const swiper = this;
      if (swiper.initialized) return swiper;
      const mounted = swiper.mount(el);
      if (mounted === false) return swiper;
      swiper.emit('beforeInit'); // Set breakpoint

      if (swiper.params.breakpoints) {
        swiper.setBreakpoint();
      } // Add Classes


      swiper.addClasses(); // Create loop

      if (swiper.params.loop) {
        swiper.loopCreate();
      } // Update size


      swiper.updateSize(); // Update slides

      swiper.updateSlides();

      if (swiper.params.watchOverflow) {
        swiper.checkOverflow();
      } // Set Grab Cursor


      if (swiper.params.grabCursor && swiper.enabled) {
        swiper.setGrabCursor();
      }

      if (swiper.params.preloadImages) {
        swiper.preloadImages();
      } // Slide To Initial Slide


      if (swiper.params.loop) {
        swiper.slideTo(swiper.params.initialSlide + swiper.loopedSlides, 0, swiper.params.runCallbacksOnInit, false, true);
      } else {
        swiper.slideTo(swiper.params.initialSlide, 0, swiper.params.runCallbacksOnInit, false, true);
      } // Attach events


      swiper.attachEvents(); // Init Flag

      swiper.initialized = true; // Emit

      swiper.emit('init');
      swiper.emit('afterInit');
      return swiper;
    }

    destroy(deleteInstance = true, cleanStyles = true) {
      const swiper = this;
      const {
        params,
        $el,
        $wrapperEl,
        slides
      } = swiper;

      if (typeof swiper.params === 'undefined' || swiper.destroyed) {
        return null;
      }

      swiper.emit('beforeDestroy'); // Init Flag

      swiper.initialized = false; // Detach events

      swiper.detachEvents(); // Destroy loop

      if (params.loop) {
        swiper.loopDestroy();
      } // Cleanup styles


      if (cleanStyles) {
        swiper.removeClasses();
        $el.removeAttr('style');
        $wrapperEl.removeAttr('style');

        if (slides && slides.length) {
          slides.removeClass([params.slideVisibleClass, params.slideActiveClass, params.slideNextClass, params.slidePrevClass].join(' ')).removeAttr('style').removeAttr('data-swiper-slide-index');
        }
      }

      swiper.emit('destroy'); // Detach emitter events

      Object.keys(swiper.eventsListeners).forEach(eventName => {
        swiper.off(eventName);
      });

      if (deleteInstance !== false) {
        swiper.$el[0].swiper = null;
        deleteProps(swiper);
      }

      swiper.destroyed = true;
      return null;
    }

    static extendDefaults(newDefaults) {
      extend$1(extendedDefaults, newDefaults);
    }

    static get extendedDefaults() {
      return extendedDefaults;
    }

    static get defaults() {
      return defaults$1;
    }

    static installModule(mod) {
      if (!Swiper.prototype.__modules__) Swiper.prototype.__modules__ = [];
      const modules = Swiper.prototype.__modules__;

      if (typeof mod === 'function' && modules.indexOf(mod) < 0) {
        modules.push(mod);
      }
    }

    static use(module) {
      if (Array.isArray(module)) {
        module.forEach(m => Swiper.installModule(m));
        return Swiper;
      }

      Swiper.installModule(module);
      return Swiper;
    }

  }

  Object.keys(prototypes).forEach(prototypeGroup => {
    Object.keys(prototypes[prototypeGroup]).forEach(protoMethod => {
      Swiper.prototype[protoMethod] = prototypes[prototypeGroup][protoMethod];
    });
  });
  Swiper.use([Resize, Observer]);

  /* eslint-disable consistent-return */
  function Mousewheel({
    swiper,
    extendParams,
    on,
    emit
  }) {
    const window = getWindow();
    extendParams({
      mousewheel: {
        enabled: false,
        releaseOnEdges: false,
        invert: false,
        forceToAxis: false,
        sensitivity: 1,
        eventsTarget: 'container',
        thresholdDelta: null,
        thresholdTime: null
      }
    });
    swiper.mousewheel = {
      enabled: false
    };
    let timeout;
    let lastScrollTime = now$2();
    let lastEventBeforeSnap;
    const recentWheelEvents = [];

    function normalize(e) {
      // Reasonable defaults
      const PIXEL_STEP = 10;
      const LINE_HEIGHT = 40;
      const PAGE_HEIGHT = 800;
      let sX = 0;
      let sY = 0; // spinX, spinY

      let pX = 0;
      let pY = 0; // pixelX, pixelY
      // Legacy

      if ('detail' in e) {
        sY = e.detail;
      }

      if ('wheelDelta' in e) {
        sY = -e.wheelDelta / 120;
      }

      if ('wheelDeltaY' in e) {
        sY = -e.wheelDeltaY / 120;
      }

      if ('wheelDeltaX' in e) {
        sX = -e.wheelDeltaX / 120;
      } // side scrolling on FF with DOMMouseScroll


      if ('axis' in e && e.axis === e.HORIZONTAL_AXIS) {
        sX = sY;
        sY = 0;
      }

      pX = sX * PIXEL_STEP;
      pY = sY * PIXEL_STEP;

      if ('deltaY' in e) {
        pY = e.deltaY;
      }

      if ('deltaX' in e) {
        pX = e.deltaX;
      }

      if (e.shiftKey && !pX) {
        // if user scrolls with shift he wants horizontal scroll
        pX = pY;
        pY = 0;
      }

      if ((pX || pY) && e.deltaMode) {
        if (e.deltaMode === 1) {
          // delta in LINE units
          pX *= LINE_HEIGHT;
          pY *= LINE_HEIGHT;
        } else {
          // delta in PAGE units
          pX *= PAGE_HEIGHT;
          pY *= PAGE_HEIGHT;
        }
      } // Fall-back if spin cannot be determined


      if (pX && !sX) {
        sX = pX < 1 ? -1 : 1;
      }

      if (pY && !sY) {
        sY = pY < 1 ? -1 : 1;
      }

      return {
        spinX: sX,
        spinY: sY,
        pixelX: pX,
        pixelY: pY
      };
    }

    function handleMouseEnter() {
      if (!swiper.enabled) return;
      swiper.mouseEntered = true;
    }

    function handleMouseLeave() {
      if (!swiper.enabled) return;
      swiper.mouseEntered = false;
    }

    function animateSlider(newEvent) {
      if (swiper.params.mousewheel.thresholdDelta && newEvent.delta < swiper.params.mousewheel.thresholdDelta) {
        // Prevent if delta of wheel scroll delta is below configured threshold
        return false;
      }

      if (swiper.params.mousewheel.thresholdTime && now$2() - lastScrollTime < swiper.params.mousewheel.thresholdTime) {
        // Prevent if time between scrolls is below configured threshold
        return false;
      } // If the movement is NOT big enough and
      // if the last time the user scrolled was too close to the current one (avoid continuously triggering the slider):
      //   Don't go any further (avoid insignificant scroll movement).


      if (newEvent.delta >= 6 && now$2() - lastScrollTime < 60) {
        // Return false as a default
        return true;
      } // If user is scrolling towards the end:
      //   If the slider hasn't hit the latest slide or
      //   if the slider is a loop and
      //   if the slider isn't moving right now:
      //     Go to next slide and
      //     emit a scroll event.
      // Else (the user is scrolling towards the beginning) and
      // if the slider hasn't hit the first slide or
      // if the slider is a loop and
      // if the slider isn't moving right now:
      //   Go to prev slide and
      //   emit a scroll event.


      if (newEvent.direction < 0) {
        if ((!swiper.isEnd || swiper.params.loop) && !swiper.animating) {
          swiper.slideNext();
          emit('scroll', newEvent.raw);
        }
      } else if ((!swiper.isBeginning || swiper.params.loop) && !swiper.animating) {
        swiper.slidePrev();
        emit('scroll', newEvent.raw);
      } // If you got here is because an animation has been triggered so store the current time


      lastScrollTime = new window.Date().getTime(); // Return false as a default

      return false;
    }

    function releaseScroll(newEvent) {
      const params = swiper.params.mousewheel;

      if (newEvent.direction < 0) {
        if (swiper.isEnd && !swiper.params.loop && params.releaseOnEdges) {
          // Return true to animate scroll on edges
          return true;
        }
      } else if (swiper.isBeginning && !swiper.params.loop && params.releaseOnEdges) {
        // Return true to animate scroll on edges
        return true;
      }

      return false;
    }

    function handle(event) {
      let e = event;
      let disableParentSwiper = true;
      if (!swiper.enabled) return;
      const params = swiper.params.mousewheel;

      if (swiper.params.cssMode) {
        e.preventDefault();
      }

      let target = swiper.$el;

      if (swiper.params.mousewheel.eventsTarget !== 'container') {
        target = $(swiper.params.mousewheel.eventsTarget);
      }

      if (!swiper.mouseEntered && !target[0].contains(e.target) && !params.releaseOnEdges) return true;
      if (e.originalEvent) e = e.originalEvent; // jquery fix

      let delta = 0;
      const rtlFactor = swiper.rtlTranslate ? -1 : 1;
      const data = normalize(e);

      if (params.forceToAxis) {
        if (swiper.isHorizontal()) {
          if (Math.abs(data.pixelX) > Math.abs(data.pixelY)) delta = -data.pixelX * rtlFactor;else return true;
        } else if (Math.abs(data.pixelY) > Math.abs(data.pixelX)) delta = -data.pixelY;else return true;
      } else {
        delta = Math.abs(data.pixelX) > Math.abs(data.pixelY) ? -data.pixelX * rtlFactor : -data.pixelY;
      }

      if (delta === 0) return true;
      if (params.invert) delta = -delta; // Get the scroll positions

      let positions = swiper.getTranslate() + delta * params.sensitivity;
      if (positions >= swiper.minTranslate()) positions = swiper.minTranslate();
      if (positions <= swiper.maxTranslate()) positions = swiper.maxTranslate(); // When loop is true:
      //     the disableParentSwiper will be true.
      // When loop is false:
      //     if the scroll positions is not on edge,
      //     then the disableParentSwiper will be true.
      //     if the scroll on edge positions,
      //     then the disableParentSwiper will be false.

      disableParentSwiper = swiper.params.loop ? true : !(positions === swiper.minTranslate() || positions === swiper.maxTranslate());
      if (disableParentSwiper && swiper.params.nested) e.stopPropagation();

      if (!swiper.params.freeMode || !swiper.params.freeMode.enabled) {
        // Register the new event in a variable which stores the relevant data
        const newEvent = {
          time: now$2(),
          delta: Math.abs(delta),
          direction: Math.sign(delta),
          raw: event
        }; // Keep the most recent events

        if (recentWheelEvents.length >= 2) {
          recentWheelEvents.shift(); // only store the last N events
        }

        const prevEvent = recentWheelEvents.length ? recentWheelEvents[recentWheelEvents.length - 1] : undefined;
        recentWheelEvents.push(newEvent); // If there is at least one previous recorded event:
        //   If direction has changed or
        //   if the scroll is quicker than the previous one:
        //     Animate the slider.
        // Else (this is the first time the wheel is moved):
        //     Animate the slider.

        if (prevEvent) {
          if (newEvent.direction !== prevEvent.direction || newEvent.delta > prevEvent.delta || newEvent.time > prevEvent.time + 150) {
            animateSlider(newEvent);
          }
        } else {
          animateSlider(newEvent);
        } // If it's time to release the scroll:
        //   Return now so you don't hit the preventDefault.


        if (releaseScroll(newEvent)) {
          return true;
        }
      } else {
        // Freemode or scrollContainer:
        // If we recently snapped after a momentum scroll, then ignore wheel events
        // to give time for the deceleration to finish. Stop ignoring after 500 msecs
        // or if it's a new scroll (larger delta or inverse sign as last event before
        // an end-of-momentum snap).
        const newEvent = {
          time: now$2(),
          delta: Math.abs(delta),
          direction: Math.sign(delta)
        };
        const ignoreWheelEvents = lastEventBeforeSnap && newEvent.time < lastEventBeforeSnap.time + 500 && newEvent.delta <= lastEventBeforeSnap.delta && newEvent.direction === lastEventBeforeSnap.direction;

        if (!ignoreWheelEvents) {
          lastEventBeforeSnap = undefined;

          if (swiper.params.loop) {
            swiper.loopFix();
          }

          let position = swiper.getTranslate() + delta * params.sensitivity;
          const wasBeginning = swiper.isBeginning;
          const wasEnd = swiper.isEnd;
          if (position >= swiper.minTranslate()) position = swiper.minTranslate();
          if (position <= swiper.maxTranslate()) position = swiper.maxTranslate();
          swiper.setTransition(0);
          swiper.setTranslate(position);
          swiper.updateProgress();
          swiper.updateActiveIndex();
          swiper.updateSlidesClasses();

          if (!wasBeginning && swiper.isBeginning || !wasEnd && swiper.isEnd) {
            swiper.updateSlidesClasses();
          }

          if (swiper.params.freeMode.sticky) {
            // When wheel scrolling starts with sticky (aka snap) enabled, then detect
            // the end of a momentum scroll by storing recent (N=15?) wheel events.
            // 1. do all N events have decreasing or same (absolute value) delta?
            // 2. did all N events arrive in the last M (M=500?) msecs?
            // 3. does the earliest event have an (absolute value) delta that's
            //    at least P (P=1?) larger than the most recent event's delta?
            // 4. does the latest event have a delta that's smaller than Q (Q=6?) pixels?
            // If 1-4 are "yes" then we're near the end of a momentum scroll deceleration.
            // Snap immediately and ignore remaining wheel events in this scroll.
            // See comment above for "remaining wheel events in this scroll" determination.
            // If 1-4 aren't satisfied, then wait to snap until 500ms after the last event.
            clearTimeout(timeout);
            timeout = undefined;

            if (recentWheelEvents.length >= 15) {
              recentWheelEvents.shift(); // only store the last N events
            }

            const prevEvent = recentWheelEvents.length ? recentWheelEvents[recentWheelEvents.length - 1] : undefined;
            const firstEvent = recentWheelEvents[0];
            recentWheelEvents.push(newEvent);

            if (prevEvent && (newEvent.delta > prevEvent.delta || newEvent.direction !== prevEvent.direction)) {
              // Increasing or reverse-sign delta means the user started scrolling again. Clear the wheel event log.
              recentWheelEvents.splice(0);
            } else if (recentWheelEvents.length >= 15 && newEvent.time - firstEvent.time < 500 && firstEvent.delta - newEvent.delta >= 1 && newEvent.delta <= 6) {
              // We're at the end of the deceleration of a momentum scroll, so there's no need
              // to wait for more events. Snap ASAP on the next tick.
              // Also, because there's some remaining momentum we'll bias the snap in the
              // direction of the ongoing scroll because it's better UX for the scroll to snap
              // in the same direction as the scroll instead of reversing to snap.  Therefore,
              // if it's already scrolled more than 20% in the current direction, keep going.
              const snapToThreshold = delta > 0 ? 0.8 : 0.2;
              lastEventBeforeSnap = newEvent;
              recentWheelEvents.splice(0);
              timeout = nextTick(() => {
                swiper.slideToClosest(swiper.params.speed, true, undefined, snapToThreshold);
              }, 0); // no delay; move on next tick
            }

            if (!timeout) {
              // if we get here, then we haven't detected the end of a momentum scroll, so
              // we'll consider a scroll "complete" when there haven't been any wheel events
              // for 500ms.
              timeout = nextTick(() => {
                const snapToThreshold = 0.5;
                lastEventBeforeSnap = newEvent;
                recentWheelEvents.splice(0);
                swiper.slideToClosest(swiper.params.speed, true, undefined, snapToThreshold);
              }, 500);
            }
          } // Emit event


          if (!ignoreWheelEvents) emit('scroll', e); // Stop autoplay

          if (swiper.params.autoplay && swiper.params.autoplayDisableOnInteraction) swiper.autoplay.stop(); // Return page scroll on edge positions

          if (position === swiper.minTranslate() || position === swiper.maxTranslate()) return true;
        }
      }

      if (e.preventDefault) e.preventDefault();else e.returnValue = false;
      return false;
    }

    function events(method) {
      let target = swiper.$el;

      if (swiper.params.mousewheel.eventsTarget !== 'container') {
        target = $(swiper.params.mousewheel.eventsTarget);
      }

      target[method]('mouseenter', handleMouseEnter);
      target[method]('mouseleave', handleMouseLeave);
      target[method]('wheel', handle);
    }

    function enable() {
      if (swiper.params.cssMode) {
        swiper.wrapperEl.removeEventListener('wheel', handle);
        return true;
      }

      if (swiper.mousewheel.enabled) return false;
      events('on');
      swiper.mousewheel.enabled = true;
      return true;
    }

    function disable() {
      if (swiper.params.cssMode) {
        swiper.wrapperEl.addEventListener(event, handle);
        return true;
      }

      if (!swiper.mousewheel.enabled) return false;
      events('off');
      swiper.mousewheel.enabled = false;
      return true;
    }

    on('init', () => {
      if (!swiper.params.mousewheel.enabled && swiper.params.cssMode) {
        disable();
      }

      if (swiper.params.mousewheel.enabled) enable();
    });
    on('destroy', () => {
      if (swiper.params.cssMode) {
        enable();
      }

      if (swiper.mousewheel.enabled) disable();
    });
    Object.assign(swiper.mousewheel, {
      enable,
      disable
    });
  }

  function createElementIfNotDefined(swiper, originalParams, params, checkProps) {
    const document = getDocument();

    if (swiper.params.createElements) {
      Object.keys(checkProps).forEach(key => {
        if (!params[key] && params.auto === true) {
          let element = swiper.$el.children(`.${checkProps[key]}`)[0];

          if (!element) {
            element = document.createElement('div');
            element.className = checkProps[key];
            swiper.$el.append(element);
          }

          params[key] = element;
          originalParams[key] = element;
        }
      });
    }

    return params;
  }

  function Navigation({
    swiper,
    extendParams,
    on,
    emit
  }) {
    extendParams({
      navigation: {
        nextEl: null,
        prevEl: null,
        hideOnClick: false,
        disabledClass: 'swiper-button-disabled',
        hiddenClass: 'swiper-button-hidden',
        lockClass: 'swiper-button-lock',
        navigationDisabledClass: 'swiper-navigation-disabled'
      }
    });
    swiper.navigation = {
      nextEl: null,
      $nextEl: null,
      prevEl: null,
      $prevEl: null
    };

    function getEl(el) {
      let $el;

      if (el) {
        $el = $(el);

        if (swiper.params.uniqueNavElements && typeof el === 'string' && $el.length > 1 && swiper.$el.find(el).length === 1) {
          $el = swiper.$el.find(el);
        }
      }

      return $el;
    }

    function toggleEl($el, disabled) {
      const params = swiper.params.navigation;

      if ($el && $el.length > 0) {
        $el[disabled ? 'addClass' : 'removeClass'](params.disabledClass);
        if ($el[0] && $el[0].tagName === 'BUTTON') $el[0].disabled = disabled;

        if (swiper.params.watchOverflow && swiper.enabled) {
          $el[swiper.isLocked ? 'addClass' : 'removeClass'](params.lockClass);
        }
      }
    }

    function update() {
      // Update Navigation Buttons
      if (swiper.params.loop) return;
      const {
        $nextEl,
        $prevEl
      } = swiper.navigation;
      toggleEl($prevEl, swiper.isBeginning && !swiper.params.rewind);
      toggleEl($nextEl, swiper.isEnd && !swiper.params.rewind);
    }

    function onPrevClick(e) {
      e.preventDefault();
      if (swiper.isBeginning && !swiper.params.loop && !swiper.params.rewind) return;
      swiper.slidePrev();
      emit('navigationPrev');
    }

    function onNextClick(e) {
      e.preventDefault();
      if (swiper.isEnd && !swiper.params.loop && !swiper.params.rewind) return;
      swiper.slideNext();
      emit('navigationNext');
    }

    function init() {
      const params = swiper.params.navigation;
      swiper.params.navigation = createElementIfNotDefined(swiper, swiper.originalParams.navigation, swiper.params.navigation, {
        nextEl: 'swiper-button-next',
        prevEl: 'swiper-button-prev'
      });
      if (!(params.nextEl || params.prevEl)) return;
      const $nextEl = getEl(params.nextEl);
      const $prevEl = getEl(params.prevEl);

      if ($nextEl && $nextEl.length > 0) {
        $nextEl.on('click', onNextClick);
      }

      if ($prevEl && $prevEl.length > 0) {
        $prevEl.on('click', onPrevClick);
      }

      Object.assign(swiper.navigation, {
        $nextEl,
        nextEl: $nextEl && $nextEl[0],
        $prevEl,
        prevEl: $prevEl && $prevEl[0]
      });

      if (!swiper.enabled) {
        if ($nextEl) $nextEl.addClass(params.lockClass);
        if ($prevEl) $prevEl.addClass(params.lockClass);
      }
    }

    function destroy() {
      const {
        $nextEl,
        $prevEl
      } = swiper.navigation;

      if ($nextEl && $nextEl.length) {
        $nextEl.off('click', onNextClick);
        $nextEl.removeClass(swiper.params.navigation.disabledClass);
      }

      if ($prevEl && $prevEl.length) {
        $prevEl.off('click', onPrevClick);
        $prevEl.removeClass(swiper.params.navigation.disabledClass);
      }
    }

    on('init', () => {
      if (swiper.params.navigation.enabled === false) {
        // eslint-disable-next-line
        disable();
      } else {
        init();
        update();
      }
    });
    on('toEdge fromEdge lock unlock', () => {
      update();
    });
    on('destroy', () => {
      destroy();
    });
    on('enable disable', () => {
      const {
        $nextEl,
        $prevEl
      } = swiper.navigation;

      if ($nextEl) {
        $nextEl[swiper.enabled ? 'removeClass' : 'addClass'](swiper.params.navigation.lockClass);
      }

      if ($prevEl) {
        $prevEl[swiper.enabled ? 'removeClass' : 'addClass'](swiper.params.navigation.lockClass);
      }
    });
    on('click', (_s, e) => {
      const {
        $nextEl,
        $prevEl
      } = swiper.navigation;
      const targetEl = e.target;

      if (swiper.params.navigation.hideOnClick && !$(targetEl).is($prevEl) && !$(targetEl).is($nextEl)) {
        if (swiper.pagination && swiper.params.pagination && swiper.params.pagination.clickable && (swiper.pagination.el === targetEl || swiper.pagination.el.contains(targetEl))) return;
        let isHidden;

        if ($nextEl) {
          isHidden = $nextEl.hasClass(swiper.params.navigation.hiddenClass);
        } else if ($prevEl) {
          isHidden = $prevEl.hasClass(swiper.params.navigation.hiddenClass);
        }

        if (isHidden === true) {
          emit('navigationShow');
        } else {
          emit('navigationHide');
        }

        if ($nextEl) {
          $nextEl.toggleClass(swiper.params.navigation.hiddenClass);
        }

        if ($prevEl) {
          $prevEl.toggleClass(swiper.params.navigation.hiddenClass);
        }
      }
    });

    const enable = () => {
      swiper.$el.removeClass(swiper.params.navigation.navigationDisabledClass);
      init();
      update();
    };

    const disable = () => {
      swiper.$el.addClass(swiper.params.navigation.navigationDisabledClass);
      destroy();
    };

    Object.assign(swiper.navigation, {
      enable,
      disable,
      update,
      init,
      destroy
    });
  }

  function Scrollbar({
    swiper,
    extendParams,
    on,
    emit
  }) {
    const document = getDocument();
    let isTouched = false;
    let timeout = null;
    let dragTimeout = null;
    let dragStartPos;
    let dragSize;
    let trackSize;
    let divider;
    extendParams({
      scrollbar: {
        el: null,
        dragSize: 'auto',
        hide: false,
        draggable: false,
        snapOnRelease: true,
        lockClass: 'swiper-scrollbar-lock',
        dragClass: 'swiper-scrollbar-drag',
        scrollbarDisabledClass: 'swiper-scrollbar-disabled',
        horizontalClass: `swiper-scrollbar-horizontal`,
        verticalClass: `swiper-scrollbar-vertical`
      }
    });
    swiper.scrollbar = {
      el: null,
      dragEl: null,
      $el: null,
      $dragEl: null
    };

    function setTranslate() {
      if (!swiper.params.scrollbar.el || !swiper.scrollbar.el) return;
      const {
        scrollbar,
        rtlTranslate: rtl,
        progress
      } = swiper;
      const {
        $dragEl,
        $el
      } = scrollbar;
      const params = swiper.params.scrollbar;
      let newSize = dragSize;
      let newPos = (trackSize - dragSize) * progress;

      if (rtl) {
        newPos = -newPos;

        if (newPos > 0) {
          newSize = dragSize - newPos;
          newPos = 0;
        } else if (-newPos + dragSize > trackSize) {
          newSize = trackSize + newPos;
        }
      } else if (newPos < 0) {
        newSize = dragSize + newPos;
        newPos = 0;
      } else if (newPos + dragSize > trackSize) {
        newSize = trackSize - newPos;
      }

      if (swiper.isHorizontal()) {
        $dragEl.transform(`translate3d(${newPos}px, 0, 0)`);
        $dragEl[0].style.width = `${newSize}px`;
      } else {
        $dragEl.transform(`translate3d(0px, ${newPos}px, 0)`);
        $dragEl[0].style.height = `${newSize}px`;
      }

      if (params.hide) {
        clearTimeout(timeout);
        $el[0].style.opacity = 1;
        timeout = setTimeout(() => {
          $el[0].style.opacity = 0;
          $el.transition(400);
        }, 1000);
      }
    }

    function setTransition(duration) {
      if (!swiper.params.scrollbar.el || !swiper.scrollbar.el) return;
      swiper.scrollbar.$dragEl.transition(duration);
    }

    function updateSize() {
      if (!swiper.params.scrollbar.el || !swiper.scrollbar.el) return;
      const {
        scrollbar
      } = swiper;
      const {
        $dragEl,
        $el
      } = scrollbar;
      $dragEl[0].style.width = '';
      $dragEl[0].style.height = '';
      trackSize = swiper.isHorizontal() ? $el[0].offsetWidth : $el[0].offsetHeight;
      divider = swiper.size / (swiper.virtualSize + swiper.params.slidesOffsetBefore - (swiper.params.centeredSlides ? swiper.snapGrid[0] : 0));

      if (swiper.params.scrollbar.dragSize === 'auto') {
        dragSize = trackSize * divider;
      } else {
        dragSize = parseInt(swiper.params.scrollbar.dragSize, 10);
      }

      if (swiper.isHorizontal()) {
        $dragEl[0].style.width = `${dragSize}px`;
      } else {
        $dragEl[0].style.height = `${dragSize}px`;
      }

      if (divider >= 1) {
        $el[0].style.display = 'none';
      } else {
        $el[0].style.display = '';
      }

      if (swiper.params.scrollbar.hide) {
        $el[0].style.opacity = 0;
      }

      if (swiper.params.watchOverflow && swiper.enabled) {
        scrollbar.$el[swiper.isLocked ? 'addClass' : 'removeClass'](swiper.params.scrollbar.lockClass);
      }
    }

    function getPointerPosition(e) {
      if (swiper.isHorizontal()) {
        return e.type === 'touchstart' || e.type === 'touchmove' ? e.targetTouches[0].clientX : e.clientX;
      }

      return e.type === 'touchstart' || e.type === 'touchmove' ? e.targetTouches[0].clientY : e.clientY;
    }

    function setDragPosition(e) {
      const {
        scrollbar,
        rtlTranslate: rtl
      } = swiper;
      const {
        $el
      } = scrollbar;
      let positionRatio;
      positionRatio = (getPointerPosition(e) - $el.offset()[swiper.isHorizontal() ? 'left' : 'top'] - (dragStartPos !== null ? dragStartPos : dragSize / 2)) / (trackSize - dragSize);
      positionRatio = Math.max(Math.min(positionRatio, 1), 0);

      if (rtl) {
        positionRatio = 1 - positionRatio;
      }

      const position = swiper.minTranslate() + (swiper.maxTranslate() - swiper.minTranslate()) * positionRatio;
      swiper.updateProgress(position);
      swiper.setTranslate(position);
      swiper.updateActiveIndex();
      swiper.updateSlidesClasses();
    }

    function onDragStart(e) {
      const params = swiper.params.scrollbar;
      const {
        scrollbar,
        $wrapperEl
      } = swiper;
      const {
        $el,
        $dragEl
      } = scrollbar;
      isTouched = true;
      dragStartPos = e.target === $dragEl[0] || e.target === $dragEl ? getPointerPosition(e) - e.target.getBoundingClientRect()[swiper.isHorizontal() ? 'left' : 'top'] : null;
      e.preventDefault();
      e.stopPropagation();
      $wrapperEl.transition(100);
      $dragEl.transition(100);
      setDragPosition(e);
      clearTimeout(dragTimeout);
      $el.transition(0);

      if (params.hide) {
        $el.css('opacity', 1);
      }

      if (swiper.params.cssMode) {
        swiper.$wrapperEl.css('scroll-snap-type', 'none');
      }

      emit('scrollbarDragStart', e);
    }

    function onDragMove(e) {
      const {
        scrollbar,
        $wrapperEl
      } = swiper;
      const {
        $el,
        $dragEl
      } = scrollbar;
      if (!isTouched) return;
      if (e.preventDefault) e.preventDefault();else e.returnValue = false;
      setDragPosition(e);
      $wrapperEl.transition(0);
      $el.transition(0);
      $dragEl.transition(0);
      emit('scrollbarDragMove', e);
    }

    function onDragEnd(e) {
      const params = swiper.params.scrollbar;
      const {
        scrollbar,
        $wrapperEl
      } = swiper;
      const {
        $el
      } = scrollbar;
      if (!isTouched) return;
      isTouched = false;

      if (swiper.params.cssMode) {
        swiper.$wrapperEl.css('scroll-snap-type', '');
        $wrapperEl.transition('');
      }

      if (params.hide) {
        clearTimeout(dragTimeout);
        dragTimeout = nextTick(() => {
          $el.css('opacity', 0);
          $el.transition(400);
        }, 1000);
      }

      emit('scrollbarDragEnd', e);

      if (params.snapOnRelease) {
        swiper.slideToClosest();
      }
    }

    function events(method) {
      const {
        scrollbar,
        touchEventsTouch,
        touchEventsDesktop,
        params,
        support
      } = swiper;
      const $el = scrollbar.$el;
      if (!$el) return;
      const target = $el[0];
      const activeListener = support.passiveListener && params.passiveListeners ? {
        passive: false,
        capture: false
      } : false;
      const passiveListener = support.passiveListener && params.passiveListeners ? {
        passive: true,
        capture: false
      } : false;
      if (!target) return;
      const eventMethod = method === 'on' ? 'addEventListener' : 'removeEventListener';

      if (!support.touch) {
        target[eventMethod](touchEventsDesktop.start, onDragStart, activeListener);
        document[eventMethod](touchEventsDesktop.move, onDragMove, activeListener);
        document[eventMethod](touchEventsDesktop.end, onDragEnd, passiveListener);
      } else {
        target[eventMethod](touchEventsTouch.start, onDragStart, activeListener);
        target[eventMethod](touchEventsTouch.move, onDragMove, activeListener);
        target[eventMethod](touchEventsTouch.end, onDragEnd, passiveListener);
      }
    }

    function enableDraggable() {
      if (!swiper.params.scrollbar.el || !swiper.scrollbar.el) return;
      events('on');
    }

    function disableDraggable() {
      if (!swiper.params.scrollbar.el || !swiper.scrollbar.el) return;
      events('off');
    }

    function init() {
      const {
        scrollbar,
        $el: $swiperEl
      } = swiper;
      swiper.params.scrollbar = createElementIfNotDefined(swiper, swiper.originalParams.scrollbar, swiper.params.scrollbar, {
        el: 'swiper-scrollbar'
      });
      const params = swiper.params.scrollbar;
      if (!params.el) return;
      let $el = $(params.el);

      if (swiper.params.uniqueNavElements && typeof params.el === 'string' && $el.length > 1 && $swiperEl.find(params.el).length === 1) {
        $el = $swiperEl.find(params.el);
      }

      $el.addClass(swiper.isHorizontal() ? params.horizontalClass : params.verticalClass);
      let $dragEl = $el.find(`.${swiper.params.scrollbar.dragClass}`);

      if ($dragEl.length === 0) {
        $dragEl = $(`<div class="${swiper.params.scrollbar.dragClass}"></div>`);
        $el.append($dragEl);
      }

      Object.assign(scrollbar, {
        $el,
        el: $el[0],
        $dragEl,
        dragEl: $dragEl[0]
      });

      if (params.draggable) {
        enableDraggable();
      }

      if ($el) {
        $el[swiper.enabled ? 'removeClass' : 'addClass'](swiper.params.scrollbar.lockClass);
      }
    }

    function destroy() {
      const params = swiper.params.scrollbar;
      const $el = swiper.scrollbar.$el;

      if ($el) {
        $el.removeClass(swiper.isHorizontal() ? params.horizontalClass : params.verticalClass);
      }

      disableDraggable();
    }

    on('init', () => {
      if (swiper.params.scrollbar.enabled === false) {
        // eslint-disable-next-line
        disable();
      } else {
        init();
        updateSize();
        setTranslate();
      }
    });
    on('update resize observerUpdate lock unlock', () => {
      updateSize();
    });
    on('setTranslate', () => {
      setTranslate();
    });
    on('setTransition', (_s, duration) => {
      setTransition(duration);
    });
    on('enable disable', () => {
      const {
        $el
      } = swiper.scrollbar;

      if ($el) {
        $el[swiper.enabled ? 'removeClass' : 'addClass'](swiper.params.scrollbar.lockClass);
      }
    });
    on('destroy', () => {
      destroy();
    });

    const enable = () => {
      swiper.$el.removeClass(swiper.params.scrollbar.scrollbarDisabledClass);

      if (swiper.scrollbar.$el) {
        swiper.scrollbar.$el.removeClass(swiper.params.scrollbar.scrollbarDisabledClass);
      }

      init();
      updateSize();
      setTranslate();
    };

    const disable = () => {
      swiper.$el.addClass(swiper.params.scrollbar.scrollbarDisabledClass);

      if (swiper.scrollbar.$el) {
        swiper.scrollbar.$el.addClass(swiper.params.scrollbar.scrollbarDisabledClass);
      }

      destroy();
    };

    Object.assign(swiper.scrollbar, {
      enable,
      disable,
      updateSize,
      setTranslate,
      init,
      destroy
    });
  }

  /* eslint no-underscore-dangle: "off" */
  function Autoplay({
    swiper,
    extendParams,
    on,
    emit
  }) {
    let timeout;
    swiper.autoplay = {
      running: false,
      paused: false
    };
    extendParams({
      autoplay: {
        enabled: false,
        delay: 3000,
        waitForTransition: true,
        disableOnInteraction: true,
        stopOnLastSlide: false,
        reverseDirection: false,
        pauseOnMouseEnter: false
      }
    });

    function run() {
      if (!swiper.size) {
        swiper.autoplay.running = false;
        swiper.autoplay.paused = false;
        return;
      }

      const $activeSlideEl = swiper.slides.eq(swiper.activeIndex);
      let delay = swiper.params.autoplay.delay;

      if ($activeSlideEl.attr('data-swiper-autoplay')) {
        delay = $activeSlideEl.attr('data-swiper-autoplay') || swiper.params.autoplay.delay;
      }

      clearTimeout(timeout);
      timeout = nextTick(() => {
        let autoplayResult;

        if (swiper.params.autoplay.reverseDirection) {
          if (swiper.params.loop) {
            swiper.loopFix();
            autoplayResult = swiper.slidePrev(swiper.params.speed, true, true);
            emit('autoplay');
          } else if (!swiper.isBeginning) {
            autoplayResult = swiper.slidePrev(swiper.params.speed, true, true);
            emit('autoplay');
          } else if (!swiper.params.autoplay.stopOnLastSlide) {
            autoplayResult = swiper.slideTo(swiper.slides.length - 1, swiper.params.speed, true, true);
            emit('autoplay');
          } else {
            stop();
          }
        } else if (swiper.params.loop) {
          swiper.loopFix();
          autoplayResult = swiper.slideNext(swiper.params.speed, true, true);
          emit('autoplay');
        } else if (!swiper.isEnd) {
          autoplayResult = swiper.slideNext(swiper.params.speed, true, true);
          emit('autoplay');
        } else if (!swiper.params.autoplay.stopOnLastSlide) {
          autoplayResult = swiper.slideTo(0, swiper.params.speed, true, true);
          emit('autoplay');
        } else {
          stop();
        }

        if (swiper.params.cssMode && swiper.autoplay.running) run();else if (autoplayResult === false) {
          run();
        }
      }, delay);
    }

    function start() {
      if (typeof timeout !== 'undefined') return false;
      if (swiper.autoplay.running) return false;
      swiper.autoplay.running = true;
      emit('autoplayStart');
      run();
      return true;
    }

    function stop() {
      if (!swiper.autoplay.running) return false;
      if (typeof timeout === 'undefined') return false;

      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      swiper.autoplay.running = false;
      emit('autoplayStop');
      return true;
    }

    function pause(speed) {
      if (!swiper.autoplay.running) return;
      if (swiper.autoplay.paused) return;
      if (timeout) clearTimeout(timeout);
      swiper.autoplay.paused = true;

      if (speed === 0 || !swiper.params.autoplay.waitForTransition) {
        swiper.autoplay.paused = false;
        run();
      } else {
        ['transitionend', 'webkitTransitionEnd'].forEach(event => {
          swiper.$wrapperEl[0].addEventListener(event, onTransitionEnd);
        });
      }
    }

    function onVisibilityChange() {
      const document = getDocument();

      if (document.visibilityState === 'hidden' && swiper.autoplay.running) {
        pause();
      }

      if (document.visibilityState === 'visible' && swiper.autoplay.paused) {
        run();
        swiper.autoplay.paused = false;
      }
    }

    function onTransitionEnd(e) {
      if (!swiper || swiper.destroyed || !swiper.$wrapperEl) return;
      if (e.target !== swiper.$wrapperEl[0]) return;
      ['transitionend', 'webkitTransitionEnd'].forEach(event => {
        swiper.$wrapperEl[0].removeEventListener(event, onTransitionEnd);
      });
      swiper.autoplay.paused = false;

      if (!swiper.autoplay.running) {
        stop();
      } else {
        run();
      }
    }

    function onMouseEnter() {
      if (swiper.params.autoplay.disableOnInteraction) {
        stop();
      } else {
        emit('autoplayPause');
        pause();
      }

      ['transitionend', 'webkitTransitionEnd'].forEach(event => {
        swiper.$wrapperEl[0].removeEventListener(event, onTransitionEnd);
      });
    }

    function onMouseLeave() {
      if (swiper.params.autoplay.disableOnInteraction) {
        return;
      }

      swiper.autoplay.paused = false;
      emit('autoplayResume');
      run();
    }

    function attachMouseEvents() {
      if (swiper.params.autoplay.pauseOnMouseEnter) {
        swiper.$el.on('mouseenter', onMouseEnter);
        swiper.$el.on('mouseleave', onMouseLeave);
      }
    }

    function detachMouseEvents() {
      swiper.$el.off('mouseenter', onMouseEnter);
      swiper.$el.off('mouseleave', onMouseLeave);
    }

    on('init', () => {
      if (swiper.params.autoplay.enabled) {
        start();
        const document = getDocument();
        document.addEventListener('visibilitychange', onVisibilityChange);
        attachMouseEvents();
      }
    });
    on('beforeTransitionStart', (_s, speed, internal) => {
      if (swiper.autoplay.running) {
        if (internal || !swiper.params.autoplay.disableOnInteraction) {
          swiper.autoplay.pause(speed);
        } else {
          stop();
        }
      }
    });
    on('sliderFirstMove', () => {
      if (swiper.autoplay.running) {
        if (swiper.params.autoplay.disableOnInteraction) {
          stop();
        } else {
          pause();
        }
      }
    });
    on('touchEnd', () => {
      if (swiper.params.cssMode && swiper.autoplay.paused && !swiper.params.autoplay.disableOnInteraction) {
        run();
      }
    });
    on('destroy', () => {
      detachMouseEvents();

      if (swiper.autoplay.running) {
        stop();
      }

      const document = getDocument();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });
    Object.assign(swiper.autoplay, {
      pause,
      run,
      start,
      stop
    });
  }

  // import 'swiper/components/scrollbar/scrollbar.min.css';

  function genInfoSlider () {
      const slider = new Swiper('.general_info__slider', {
          modules: [ Navigation, Scrollbar, Mousewheel],
          slidesPerView: 4,
          speed: 700,
          spaceBetween: 28,
          watchOverflow: true,
          mousewheelControl: true,
          mousewheel: {
            forceToAxis: true,
          },
          navigation: {
              nextEl: '.general_info__slider_btn--next',
              prevEl: '.general_info__slider_btn--prev',
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
            1700: {
              slidesPerView: 4,
              spaceBetween: 28
            },
          },
      });
  }

  // import 'swiper/components/scrollbar/scrollbar.min.css';

  function reviewsSlider () {
      const slider = new Swiper('.reviews__slider', {
          modules: [ Navigation, Scrollbar, Mousewheel],
          slidesPerView: 4,
          speed: 700,
          spaceBetween: 28,
          watchOverflow: true,
          mousewheelControl: true,
          mousewheel: {
            forceToAxis: true,
          },
          navigation: {
              nextEl: '.reviews__slider_btn--next',
              prevEl: '.reviews__slider_btn--prev',
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
            1700: {
              slidesPerView: 4,
              spaceBetween: 28
            },
          },
      });
  }

  class MarkerElement {

      constructor(markerData, map) {
          this.map = map;
          this.markerData = markerData;
          this.marker = null;
          
          this.render();
          this.bindEventListeners();
      }

      bindEventListeners() {
          let map = this.map;
          let markerData = this.markerData;
          let marker = this.marker;


          this.marker.addEventListener('click', () =>  {

              let listEl = document.querySelector(`[data-list-id="${markerData.properties.id}"]`);
              let listElems = document.querySelectorAll(`[data-list-id]`);
              let activeListEl = [].find.call(listElems, el => el.classList.contains('is-active'));

              if (activeListEl) {
                  activeListEl.classList.remove('is-active');
              }

              listEl.classList.add('is-active');

              listEl.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center'
              });
              

              map.easeTo({
                  center: markerData.geometry.coordinates,
                  bearing: 180,
                  pitch: 70,
                  zoom: 12,
                  duration: 1500
              });

          });
      }
      
      render() {
          this.marker = document.createElement('button');
          this.marker.classList.add('marker');
          this.marker.setAttribute('data-map-link', `${this.markerData.properties.id}`);
          this.marker.innerHTML = `<div data-map-tooltip="">${this.markerData.properties.text}</div>`;
          this.marker.style.backgroundImage = 'url("/assets/img/marker.svg")';
      }

  }

  class MapListElement {

      constructor(markerData, map) {
          this.markerData = markerData;
          this.map = map;
          this.listEl = null;

          this.createListElement();
          this.bindEventListeners();
      }

      bindEventListeners() {
          let map = this.map;
          let markerData = this.markerData;

          this.listEl.addEventListener('click', () =>  {

              let listElems = document.querySelectorAll(`[data-list-id]`);
              let activeListEl = [].find.call(listElems, el => el.classList.contains('is-active'));

              if (activeListEl) {
                  activeListEl.classList.remove('is-active');
              }
              
              this.listEl.classList.add('is-active');

              map.easeTo({
                  center: markerData.geometry.coordinates,
                  bearing: 180,
                  pitch: 70,
                  zoom: 12,
                  duration: 1500
              });
          });
      }

      createListElement() {
          this.listEl = document.createElement('button');
          this.listEl.classList.add('map_list_element');
          this.listEl.setAttribute('data-list-id', `${this.markerData.properties.id}`);
          this.listEl.innerHTML = `${this.markerData.properties.text}`;
      }

  }

  class MapList {

      constructor(markerData, map) {
          this.markerData = markerData;
          this.map = map;
          this.button = null;
          this.mapList = document.querySelector('[data-map-list] .simplebar-content');

          this.createList();
      }

      createList() {
          this.button = new MapListElement(this.markerData, this.map).listEl;
          this.mapList.appendChild(this.button);
      }
  }

  class Map$1 {
      constructor({container, markers, token, style, zoom, mapCenter}) {
          this.container = container;
          this.markers = markers;
          this.map = null;
          this.token = token;
          this.style = style;
          this.mapCenter = mapCenter;
          this.zoom = zoom;
          this.markerList = {};

          this.createMap();
          this.bindEventListeners();
          // this.createList();
      }

      bindEventListeners() {
         

          let {markers, map} = this;
          
          this.map.on('load', () => {
              
              markers.features.forEach(markerData => {
                  new mapboxgl.Marker(new MarkerElement(markerData, map).marker, {offset: [0, -46]})
                  .setLngLat(markerData.geometry.coordinates)
                  .addTo(map);
              });

              map.addSource('markers', {
                  type: 'geojson',
                  data: markers,
              });

              map.getSource('markers').setData(markers);
          });
      }

      createMap() {
          mapboxgl.accessToken = this.token;
          this.map = new mapboxgl.Map({
              container: this.container,
              style: this.style,
              center: this.mapCenter,
              zoom: this.zoom,
          });
          
          this.map.scrollZoom.disable();
          this.map.addControl(new mapboxgl.NavigationControl());
      }

      createList() {
          this.markers.features.forEach(markerData => {
              new MapList(markerData, this.map);
          });
      }
      
  }

  const markers = {
      "type": "FeatureCollection",
  	"features": [
  	    {
              "type": "Feature",
              "properties": {
                  id: 1,
                  text: '',
              },
              "geometry": {
                  "type": "Point",
                  "coordinates": [
                      131.958967, 43.121333
                  ]
              }
          },
      ]
  };

  function contactsMap (el) {
      
      const mapToken = 'pk.eyJ1Ijoic2VyZWdhdG8iLCJhIjoiTVhMa2NkRSJ9.LyqhckvDNmXgLSdHiRKigw';
      const mapStyle = 'mapbox://styles/seregato/clqexs3ur00gl01qugncof93f';

      const mapbox = new Map$1({
          container: el,
          markers: markers,
          token: mapToken,
          style: mapStyle,
          zoom: 15,
          mapCenter: [131.958967, 43.121333],
      });
   
  }

  function faqDropdown() {
      const block = document.querySelectorAll('[data-dropdown-block]');
      

      block.forEach(el => {
          const btn = el.querySelector('[data-dropdown-btn]');

          btn.addEventListener('click', _ => {
              el.classList.toggle('is-open');
          });
      });
  }

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

  const carsCatalog = (_ => {
      const DOM = {};
      const state = {
          current: null,
          data: null
      };
      const init = data => {
          state.data = data;
          state.current = data[0];
          cacheDOM();
          bindEventListeners();
          render();
          console.log(state);
      };
      const cacheDOM = _ => {
          DOM.container = document.querySelector('[data-catalog-root]');
          DOM.categoryBtnsContainer = DOM.container.querySelector('[data-catalog-btns]');
          DOM.categoryContent = DOM.container.querySelector('[data-catalog-content]');
          // DOM.buyCarForm = document.querySelector('[data-buy-car-form]');
          // DOM.formCarInfo = DOM.buyCarForm.querySelector('[data-car-info]');
          // DOM.formCarBrandInput = DOM.buyCarForm.querySelector('input[name=brand]');
          // DOM.formCarModelInput = DOM.buyCarForm.querySelector('input[name=model]');
          // DOM.formCarYearInput = DOM.buyCarForm.querySelector('input[name=year]');
      };
      const bindEventListeners = _ => {
          DOM.container.addEventListener('catalog::categoryChanged', handleCategoryChange);
      };

      
      const handleCategoryChange = async ({detail}) => {
          const {id, btn} = detail;
          if (btn.classList.contains('is-active')) return

          const {categoryContent, categoryBtnsContainer} = DOM;
          const btns = categoryBtnsContainer.querySelectorAll('.best_offers__tabs_btn');
          const activeBtn = [...btns].find(btn => btn.classList.contains('is-active'));
          activeBtn.classList.remove('is-active');
          btn.classList.add('is-active');
          
          state.current = state.data.find(category => category.id === id);
          await hideElem(categoryContent);
          
          renderCategoryContent();
          showEl(categoryContent);        
      };



      const hideElem = el => {
          el.classList.remove('is-active');
          
          return new Promise((res, rej) => {
              el.addEventListener('transitionend', ({target}) => {
                  if (target.isSameNode(el)) res();
              });
          });
          
      };

     
      const render = _ => {
          renderBtns(); 
          renderCategoryContent();
          showEl(DOM.categoryContent);
      };
      
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
                      };
                      const evt = new CustomEvent('catalog::categoryChanged', {detail: detail});

                      container.dispatchEvent(evt);
                  });
                  return btn;
               
              })
              .forEach(btn => {
                  categoryBtnsContainer.appendChild(btn);
              });
          
          
      };

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
                    <div class="dot"></div>
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
                    <a class="best_offers__nav_link header__auc_btn" href="/auc" target="_blank">Посмотреть больше на аукционе 
                    <svg class="icon">
                        <use xlink:href="#arrow_small"></use>
                    </svg></a>
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
              swiper.update();
          }, 200);
          
          
      };
      const showEl = el => {
          el.classList.add('is-active');
      };

      // const setCarInForm = car => {
      //     const {formCarInfo, formCarBrandInput, formCarModelInput, formCarYearInput} = DOM;
      //     const {firm, model, year, pic, price} = car;
      //     formCarInfo.innerHTML = `
      //         <div class="modal_buy_card__img"><img data-car-pic src="${pic}"/></div>
      //         <div class="modal_buy_card__column">
      //             <div class="modal_buy_card__line">
      //                 <p class="modal_buy_card__model">${firm} ${model}</p>
      //                 <p class="modal_buy_card__year">${year}</p>
      //             </div>
      //             <p class="modal_buy_card__price">${price} р</p>
      //         </div>
      //     `;
      //     formCarBrandInput.value = firm;
      //     formCarModelInput.value = model;
      //     formCarYearInput.value = year;
      // }


      return {
          init: init
      }
  })();

  const carsPricesCatalog = (_ => {
      const DOM = {};
      const state = {
          current: null,
          data: null
      };
      const init = data => {
          state.data = data;
          state.current = data[0];
          cacheDOM();
          bindEventListeners();
          render();
          console.log(state);
      };
      const cacheDOM = _ => {
          DOM.container = document.querySelector('[data-catalog-prices-root]');
          DOM.categoryBtnsContainer = DOM.container.querySelector('[data-catalog-prices-btns]');
          DOM.categoryContent = DOM.container.querySelector('[data-catalog-prices-content]');
      };
      const bindEventListeners = _ => {
          DOM.container.addEventListener('catalog::categoryChanged', handleCategoryChange);
      };

      
      const handleCategoryChange = async ({detail}) => {
          const {id, btn} = detail;
          if (btn.classList.contains('is-active')) return

          const {categoryContent, categoryBtnsContainer} = DOM;
          const btns = categoryBtnsContainer.querySelectorAll('.best_offers__tabs_btn');
          const activeBtn = [...btns].find(btn => btn.classList.contains('is-active'));
          activeBtn.classList.remove('is-active');
          btn.classList.add('is-active');
          
          state.current = state.data.find(category => category.id === id);
          await hideElem(categoryContent);
          
          renderCategoryContent();
          showEl(categoryContent);        
      };



      const hideElem = el => {
          el.classList.remove('is-active');
          
          return new Promise((res, rej) => {
              el.addEventListener('transitionend', ({target}) => {
                  if (target.isSameNode(el)) res();
              });
          });
          
      };

     
      const render = _ => {
          renderBtns(); 
          renderCategoryContent();
          showEl(DOM.categoryContent);
      };
      
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
                      };
                      const evt = new CustomEvent('catalog::categoryChanged', {detail: detail});

                      container.dispatchEvent(evt);
                  });
                  return btn;
               
              })
              .forEach(btn => {
                  categoryBtnsContainer.appendChild(btn);
              });
          
          
      };

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
                    <div class="dot"></div>
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
                    <a class="best_offers__nav_link header__auc_btn" href="/auc" target="_blank">Посмотреть больше на аукционе 
                    <svg class="icon">
                        <use xlink:href="#arrow_small"></use>
                    </svg></a>
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
              swiper.update();
          }, 200);
          
          
      };
      const showEl = el => {
          el.classList.add('is-active');
      };


      return {
          init: init
      }
  })();

  // import 'swiper/components/scrollbar/scrollbar.min.css';

  function advanSlider () {
      const slider = new Swiper('.advantages__slider', {
          modules: [ Navigation, Scrollbar, Mousewheel],
          slidesPerView: 4,
          speed: 700,
          spaceBetween: 28,
          watchOverflow: true,
          mousewheelControl: true,
          mousewheel: {
            forceToAxis: true,
          },
          navigation: {
              nextEl: '.advantages__slider_btn--next',
              prevEl: '.advantages__slider_btn--prev',
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
            1700: {
              slidesPerView: 4,
              spaceBetween: 28
            },
          },
      });
  }

  setTimeout(() => { 
      document.querySelector('body').classList.add('on-loaded');
  }, 1000);

  document.addEventListener("DOMContentLoaded", _ => {
      if (!sessionStorage.activeSession) {
          
          setTimeout(() => {
              document.querySelector('body').classList.add('disabled');
          }, 4800);
          
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

      if (document.querySelector('.best_offers--japan_prices')) {

          (async _ => {
              const res = await fetch('/js/catalogsData/japanPricesData.json');
              const cars = await res.json();
              carsPricesCatalog.init(cars);
          })();
      }

      if (document.querySelector('.best_offers--korea')) {

          (async _ => {
              const res = await fetch('/js/catalogsData/koreaData.json');
              const cars = await res.json();
              carsCatalog.init(cars);
          })();
      }

      if (document.querySelector('.best_offers--korea_prices')) {

          (async _ => {
              const res = await fetch('/js/catalogsData/koreaPricesData.json');
              const cars = await res.json();
              carsPricesCatalog.init(cars);
          })();
      }

      if (document.querySelector('.best_offers--china')) {

          (async _ => {
              const res = await fetch('/js/catalogsData/chinaData.json');
              const cars = await res.json();
              carsCatalog.init(cars);
          })();
      }

      if (document.querySelector('.best_offers--china_prices')) {

          (async _ => {
              const res = await fetch('/js/catalogsData/chinaPricesData.json');
              const cars = await res.json();
              carsPricesCatalog.init(cars);
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
          };
          
      };

      initMap();

      let scroll = new Smooth({ 
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
          });  
      }, 0);

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
      });

  });

}());
