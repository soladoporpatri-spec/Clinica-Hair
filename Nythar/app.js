document.addEventListener("DOMContentLoaded", () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const header = document.querySelector(".site-header");
    const menuToggle = document.querySelector(".menu-toggle");
    const navPanel = document.querySelector(".nav-panel");
    const navLinks = document.querySelectorAll(".nav-links a");
    const loginModal = document.getElementById("loginModal");
    const openLoginButtons = document.querySelectorAll("[data-open-login]");
    const closeLoginButtons = document.querySelectorAll("[data-close-login]");
    const loginForm = document.getElementById("landingLoginForm");
    const loginUser = document.getElementById("loginUser");
    const loginPassword = document.getElementById("loginPassword");
    const loginStatus = document.getElementById("landingLoginStatus");
    const loginSubmit = document.querySelector("[data-login-submit]");
    const pixModal = document.getElementById("pixModal");
    const pixButtons = document.querySelectorAll("[data-pix-plan]");
    const closePixButtons = document.querySelectorAll("[data-close-pix]");
    const pixPlanName = document.getElementById("pixPlanName");
    const pixPlanPrice = document.getElementById("pixPlanPrice");
    const pixKeyInput = document.getElementById("pixKeyInput");
    const pixCopyCode = document.getElementById("pixCopyCode");
    const pixQrImage = document.getElementById("pixQrImage");
    const pixQrFallback = document.getElementById("pixQrFallback");
    const pixWhatsapp = document.getElementById("pixWhatsapp");
    const pixStatus = document.getElementById("pixStatus");
    const tabButtons = document.querySelectorAll("[data-tab-target]");
    const revealItems = [...document.querySelectorAll("[data-reveal]")];
    const revealGroups = document.querySelectorAll(".quick-panel-grid, .services-grid, .pricing-grid, .clients-grid, .process-grid, .creative-grid, .impact-board");
    const PIX_KEY = document.querySelector('meta[name="patricio-pix-key"]')?.content.trim() || "";
    const SALES_WHATSAPP = (document.querySelector('meta[name="patricio-sales-whatsapp"]')?.content || "").replace(/\D/g, "");
    const PIX_MERCHANT_NAME = "PATRICIO";
    const PIX_CITY = "ANAPOLIS";
    const API_FALLBACK_BASE = "http://127.0.0.1:4000";
    const IS_STATIC_SHOWCASE = window.location.hostname.endsWith("github.io");
    let lastFocusedElement = null;

    document.querySelectorAll("[data-sales-whatsapp]").forEach((link) => {
        if (!SALES_WHATSAPP) {
            link.hidden = true;
            return;
        }
        const message = encodeURIComponent(link.dataset.whatsappMessage || "Quero conhecer os produtos do Patricio");
        link.href = `https://wa.me/${SALES_WHATSAPP}?text=${message}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
    });

    if (!prefersReducedMotion) {
        document.body.classList.add("motion-ready");
    }

    const cursorAura = document.querySelector("[data-cursor-aura]");
    const depthCity = document.querySelector("[data-depth-city]");
    const parallaxLayers = [...document.querySelectorAll("[data-parallax-layer]")];
    const depthTilts = [...document.querySelectorAll("[data-tilt]")];
    const cardTilts = [...document.querySelectorAll(".quick-panel, .service-card, .pricing-card, .client-card, .process-step, .creative-card, .impact-card")];
    const scrollSections = [...document.querySelectorAll("main > section:not(.service-strip)")];
    const supportsFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const motionState = { targetX: 0, targetY: 0, currentX: 0, currentY: 0, scrollY: window.scrollY, frame: 0 };

    scrollSections.forEach((section, index) => {
        const sectionContent = [...section.children].find((child) => child.tagName === "DIV");
        const heading = section.querySelector("h1, h2");
        const title = (section.getAttribute("aria-label") || heading?.textContent || `Seção ${index + 1}`)
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 58);

        section.dataset.scrollSection = String(index + 1).padStart(2, "0");
        section.style.setProperty("--section-order", index);
        section.style.setProperty("--section-enter-x", `${index % 2 === 0 ? -24 : 24}px`);
        sectionContent?.classList.add("section-shell");

        const loader = document.createElement("div");
        const loaderIndex = document.createElement("span");
        const loaderTitle = document.createElement("strong");
        const loaderLine = document.createElement("i");

        loader.className = "section-loader";
        loader.setAttribute("aria-hidden", "true");
        loaderIndex.textContent = `CAPÍTULO ${String(index + 1).padStart(2, "0")}`;
        loaderTitle.textContent = title;
        loader.append(loaderIndex, loaderTitle, loaderLine);
        section.append(loader);
    });

    const activateScrollSection = (section, index, revealSection = true) => {
        scrollSections.forEach((item) => item.classList.toggle("is-section-active", item === section));
        if (revealSection) section.classList.add("has-entered");

        document.body.dataset.cityPhase = String(index % 4);
        document.body.style.setProperty("--city-shift-x", `${((index % 5) - 2) * 34}px`);
        document.body.style.setProperty("--city-lift", `${-(index % 4) * 8}px`);
        document.body.style.setProperty("--city-turn", `${((index % 5) - 2) * .7}deg`);
        depthCity?.setAttribute("data-active-section", String(index + 1).padStart(2, "0"));
    };

    if (scrollSections.length) {
        activateScrollSection(scrollSections[0], 0, false);
    }

    if (!prefersReducedMotion && "IntersectionObserver" in window) {
        const sectionVisibility = new Map(scrollSections.map((section) => [section, 0]));
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                sectionVisibility.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
                if (entry.isIntersecting && entry.intersectionRatio >= .12) {
                    entry.target.classList.add("has-entered");
                }
            });

            const currentSection = [...sectionVisibility.entries()]
                .sort((left, right) => right[1] - left[1])
                .find(([, ratio]) => ratio > 0)?.[0];

            if (currentSection) {
                activateScrollSection(currentSection, scrollSections.indexOf(currentSection));
            }
        }, {
            threshold: [0, .12, .28, .48, .68],
            rootMargin: "-8% 0px -18% 0px"
        });

        scrollSections.forEach((section) => sectionObserver.observe(section));
    } else {
        scrollSections.forEach((section) => section.classList.add("has-entered"));
        if (scrollSections.length) activateScrollSection(scrollSections[0], 0);
    }

    const renderParallax = () => {
        motionState.currentX += (motionState.targetX - motionState.currentX) * .09;
        motionState.currentY += (motionState.targetY - motionState.currentY) * .09;

        parallaxLayers.forEach((layer) => {
            const depth = Number(layer.dataset.depth || .1);
            const scrollShift = Math.max(-34, Math.min(34, motionState.scrollY * -.012 * depth));
            layer.style.setProperty("--parallax-x", `${motionState.currentX * depth * 42}px`);
            layer.style.setProperty("--parallax-y", `${motionState.currentY * depth * 30 + scrollShift}px`);
        });

        scrollSections.forEach((section) => {
            if (!section.classList.contains("has-entered")) return;
            const rect = section.getBoundingClientRect();
            const distanceFromCenter = rect.top + rect.height / 2 - window.innerHeight / 2;
            const normalized = Math.max(-1, Math.min(1, distanceFromCenter / Math.max(window.innerHeight, 1)));
            section.style.setProperty("--section-scroll-y", `${normalized * -14}px`);
            section.style.setProperty("--section-scroll-rotate", `${normalized * -.38}deg`);
        });

        if (Math.abs(motionState.targetX - motionState.currentX) > .002 || Math.abs(motionState.targetY - motionState.currentY) > .002) {
            motionState.frame = requestAnimationFrame(renderParallax);
        } else {
            motionState.frame = 0;
        }
    };

    const requestParallaxFrame = () => {
        if (motionState.frame || prefersReducedMotion) return;
        motionState.frame = requestAnimationFrame(renderParallax);
    };

    const setTiltFromPointer = (element, event, strength) => {
        const rect = element.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
        element.style.setProperty("--tilt-x", `${(0.5 - y) * strength}deg`);
        element.style.setProperty("--tilt-y", `${(x - 0.5) * strength}deg`);
        element.style.setProperty("--tilt-lift", "-5px");
        element.style.setProperty("--glare-x", `${x * 100}%`);
        element.style.setProperty("--glare-y", `${y * 100}%`);
    };

    const resetTilt = (element) => {
        element.style.setProperty("--tilt-x", "0deg");
        element.style.setProperty("--tilt-y", "0deg");
        element.style.setProperty("--tilt-lift", "0px");
    };

    if (!prefersReducedMotion && supportsFinePointer) {
        document.body.classList.add("has-pointer");

        window.addEventListener("pointermove", (event) => {
            motionState.targetX = (event.clientX / Math.max(window.innerWidth, 1) - .5) * 2;
            motionState.targetY = (event.clientY / Math.max(window.innerHeight, 1) - .5) * 2;
            cursorAura?.style.setProperty("--aura-x", `${event.clientX}px`);
            cursorAura?.style.setProperty("--aura-y", `${event.clientY}px`);
            requestParallaxFrame();
        }, { passive: true });

        document.documentElement.addEventListener("mouseleave", () => {
            motionState.targetX = 0;
            motionState.targetY = 0;
            document.body.classList.remove("has-pointer");
            requestParallaxFrame();
        });

        document.documentElement.addEventListener("mouseenter", () => document.body.classList.add("has-pointer"));

        depthTilts.forEach((element) => {
            const strength = Number(element.dataset.tiltStrength || 8);
            element.addEventListener("pointermove", (event) => setTiltFromPointer(element, event, strength));
            element.addEventListener("pointerleave", () => resetTilt(element));
        });

        cardTilts.forEach((element) => {
            element.addEventListener("pointerenter", () => element.classList.add("tilt-active"));
            element.addEventListener("pointermove", (event) => setTiltFromPointer(element, event, 7));
            element.addEventListener("pointerleave", () => {
                resetTilt(element);
                window.setTimeout(() => element.classList.remove("tilt-active"), 140);
            });
        });
    }

    window.addEventListener("scroll", () => {
        motionState.scrollY = window.scrollY;
        requestParallaxFrame();
    }, { passive: true });

    const syncHeader = () => {
        if (!header) return;
        header.classList.toggle("is-scrolled", window.scrollY > 16);
    };

    syncHeader();
    window.addEventListener("scroll", syncHeader, { passive: true });

    const setMenuState = (isOpen) => {
        if (!menuToggle || !navPanel) return;
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
        navPanel.classList.toggle("is-open", isOpen);
        document.body.classList.toggle("menu-open", isOpen);
    };

    menuToggle?.addEventListener("click", () => {
        const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
        setMenuState(!isOpen);
    });

    navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            setMenuState(false);
        });
    });

    const setActiveNav = () => {
        const activeSection = [...navLinks]
            .map((link) => {
                const section = document.querySelector(link.getAttribute("href"));
                if (!section) return null;
                return { link, section };
            })
            .filter(Boolean)
            .reverse()
            .find(({ section }) => section.getBoundingClientRect().top <= Math.min(window.innerHeight * .34, 280));

        navLinks.forEach((link) => link.classList.remove("is-active"));
        activeSection?.link.classList.add("is-active");
    };

    setActiveNav();
    window.addEventListener("scroll", setActiveNav, { passive: true });

    const openLogin = () => {
        if (IS_STATIC_SHOWCASE) {
            window.location.href = "../demo/";
            return;
        }
        if (!loginModal) return;
        lastFocusedElement = document.activeElement;
        loginModal.hidden = false;
        requestAnimationFrame(() => {
            loginModal.classList.add("is-open");
            loginUser?.focus();
        });
    };

    const closeLogin = () => {
        if (!loginModal) return;
        loginModal.classList.remove("is-open");
        window.setTimeout(() => {
            loginModal.hidden = true;
            lastFocusedElement?.focus?.();
        }, prefersReducedMotion ? 0 : 220);
    };

    openLoginButtons.forEach((button) => {
        if (IS_STATIC_SHOWCASE) {
            const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
            if (textNode) textNode.textContent = " Ver demonstração";
        }
        button.addEventListener("click", openLogin);
    });

    closeLoginButtons.forEach((button) => {
        button.addEventListener("click", closeLogin);
    });

    loginModal?.addEventListener("click", (event) => {
        if (event.target === loginModal) {
            closeLogin();
        }
    });

    const setLoginStatus = (message, type = "neutral") => {
        if (!loginStatus) return;
        loginStatus.textContent = message || "";
        loginStatus.dataset.type = type;
    };

    const setPixStatus = (message, type = "neutral") => {
        if (!pixStatus) return;
        pixStatus.textContent = message || "";
        pixStatus.dataset.type = type;
    };

    const apiBaseCandidates = () => {
        const bases = [];
        if (window.location.protocol !== "file:" && window.location.origin && window.location.origin !== "null") {
            bases.push(window.location.origin);
        }
        bases.push(API_FALLBACK_BASE);
        return [...new Set(bases.map((base) => base.replace(/\/+$/, "")))];
    };

    const fetchJsonWithFallback = async (path, options) => {
        let lastError = null;
        for (const base of apiBaseCandidates()) {
            try {
                const response = await fetch(`${base}${path}`, options);
                return { response, base };
            } catch (error) {
                lastError = error;
            }
        }
        throw new Error(`Nao consegui alcancar a API. Abra pelo painel local (${API_FALLBACK_BASE}) ou verifique se o backend esta ligado. ${lastError?.message || ""}`.trim());
    };

    const copyValue = async (value) => {
        if (!value) return false;
        try {
            if (navigator.clipboard?.writeText && window.isSecureContext) {
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch (_) {
            // Fallback abaixo cobre navegadores sem permissao de clipboard.
        }
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        textarea.remove();
        return ok;
    };

    const emvField = (id, value) => `${id}${String(value.length).padStart(2, "0")}${value}`;

    const crc16 = (payload) => {
        let crc = 0xffff;
        for (let i = 0; i < payload.length; i += 1) {
            crc ^= payload.charCodeAt(i) << 8;
            for (let bit = 0; bit < 8; bit += 1) {
                crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
                crc &= 0xffff;
            }
        }
        return crc.toString(16).toUpperCase().padStart(4, "0");
    };

    const buildPixPayload = ({ amount, description }) => {
        const cleanAmount = Number(amount || 0).toFixed(2);
        const txid = `PATRICIO${Date.now().toString().slice(-12)}`.slice(0, 25);
        const merchantAccount =
            emvField("00", "br.gov.bcb.pix") +
            emvField("01", PIX_KEY) +
            emvField("02", String(description || "Produto Patricio").slice(0, 25));
        const payloadWithoutCrc =
            emvField("00", "01") +
            emvField("26", merchantAccount) +
            emvField("52", "0000") +
            emvField("53", "986") +
            emvField("54", cleanAmount) +
            emvField("58", "BR") +
            emvField("59", PIX_MERCHANT_NAME.slice(0, 25)) +
            emvField("60", PIX_CITY.slice(0, 15)) +
            emvField("62", emvField("05", txid)) +
            "6304";
        return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`;
    };

    const renderPixQr = (payload) => {
        if (!pixQrImage || !pixQrFallback) return;

        pixQrImage.hidden = true;
        pixQrImage.removeAttribute("src");
        pixQrFallback.hidden = false;
        pixQrFallback.textContent = "Gerando QR Code PIX...";

        const base = apiBaseCandidates()[0];
        const src = `${base}/api/public/pix/qrcode?payload=${encodeURIComponent(payload)}`;

        pixQrImage.onload = () => {
            pixQrFallback.hidden = true;
            pixQrImage.hidden = false;
        };
        pixQrImage.onerror = () => {
            pixQrImage.hidden = true;
            pixQrFallback.hidden = false;
            pixQrFallback.textContent = "QR Code indisponivel agora. Use o PIX copia e cola abaixo.";
        };
        pixQrImage.src = src;
    };

    const storeDashboardSession = (data) => {
        localStorage.setItem("hair_token", data.token);
        localStorage.setItem("hair_role", data.role || "");
        if (data.barberId) localStorage.setItem("hair_barberId", data.barberId);
        if (data.storeId) localStorage.setItem("hair_storeId", data.storeId);
        if (data.storeName) localStorage.setItem("hair_store_name", data.storeName);
        if (data.businessType) localStorage.setItem("hair_business_type", data.businessType);
        if (data.bridgeUrl) localStorage.setItem("hair_bridge_url", data.bridgeUrl);
    };

    const encodeSessionForUrl = (data) => {
        const payload = {
            token: data.token,
            role: data.role || "",
            barberId: data.barberId || "",
            storeId: data.storeId || "",
            storeName: data.storeName || "",
            businessType: data.businessType || "",
            bridgeUrl: data.bridgeUrl || ""
        };
        return btoa(encodeURIComponent(JSON.stringify(payload)));
    };

    loginForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = loginUser?.value.trim();
        const password = loginPassword?.value;

        if (!username || !password) {
            setLoginStatus("Informe usuário e senha para acessar sua dashboard.", "error");
            return;
        }

        setLoginStatus("Autenticando...", "loading");
        if (loginSubmit) loginSubmit.disabled = true;

        try {
            const { response, base } = await fetchJsonWithFallback("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true"
                },
                body: JSON.stringify({ Username: username, Password: password })
            });

            const contentType = response.headers.get("content-type") || "";
            const data = contentType.includes("application/json") ? await response.json() : {};

            if (!response.ok || !data.token) {
                throw new Error(data.error || "Usuário ou senha incorretos.");
            }

            storeDashboardSession(data);
            setLoginStatus("Acesso confirmado. Abrindo dashboard...", "success");
            const targetPath = data.role === "superadmin" ? "/superadmin/index.html" : "/dashboard-improved.html";
            window.location.href = `${base}${targetPath}#nytharSession=${encodeURIComponent(encodeSessionForUrl(data))}`;
        } catch (error) {
            setLoginStatus(error.message || "Não foi possível entrar agora. Tente novamente ou solicite acesso.", "error");
        } finally {
            if (loginSubmit) loginSubmit.disabled = false;
        }
    });

    const openPix = (button) => {
        if (!pixModal) return;
        const plan = button.dataset.pixPlan || "Produto digital";
        const price = Number(button.dataset.pixPrice || 0);
        const payload = PIX_KEY ? buildPixPayload({ amount: price, description: plan }) : "";
        const whatsappText = encodeURIComponent(`Ola, fiz ou vou fazer o PIX do produto ${plan} com Patricio no valor de R$ ${price.toFixed(2).replace(".", ",")}. Segue o comprovante.`);

        if (pixPlanName) pixPlanName.textContent = plan;
        if (pixPlanPrice) {
            pixPlanPrice.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
        }
        if (pixKeyInput) pixKeyInput.value = PIX_KEY;
        if (pixCopyCode) pixCopyCode.value = payload;
        if (payload) {
            renderPixQr(payload);
        } else if (pixQrFallback) {
            pixQrImage?.removeAttribute("src");
            if (pixQrImage) pixQrImage.hidden = true;
            pixQrFallback.hidden = false;
            pixQrFallback.textContent = "Pagamento ainda nao configurado neste ambiente.";
        }
        if (pixWhatsapp) {
            pixWhatsapp.hidden = !SALES_WHATSAPP;
            pixWhatsapp.href = SALES_WHATSAPP ? `https://wa.me/${SALES_WHATSAPP}?text=${whatsappText}` : '#';
        }
        setPixStatus(
            PIX_KEY
                ? "Pagamento via PIX manual. Depois envie o comprovante para confirmar o pedido."
                : "Defina a chave PIX e o WhatsApp comercial antes de oferecer este pagamento.",
            PIX_KEY ? "neutral" : "error"
        );

        lastFocusedElement = document.activeElement;
        pixModal.hidden = false;
        requestAnimationFrame(() => {
            pixModal.classList.add("is-open");
            pixCopyCode?.focus();
        });
    };

    const closePix = () => {
        if (!pixModal) return;
        pixModal.classList.remove("is-open");
        window.setTimeout(() => {
            pixModal.hidden = true;
            lastFocusedElement?.focus?.();
        }, prefersReducedMotion ? 0 : 220);
    };

    pixButtons.forEach((button) => button.addEventListener("click", () => openPix(button)));
    closePixButtons.forEach((button) => button.addEventListener("click", closePix));

    pixModal?.addEventListener("click", (event) => {
        if (event.target === pixModal) closePix();
    });

    document.querySelector("[data-copy-pix-code]")?.addEventListener("click", async () => {
        const ok = await copyValue(pixCopyCode?.value || "");
        setPixStatus(ok ? "PIX copia e cola copiado." : "Nao consegui copiar automaticamente. Selecione e copie o codigo.", ok ? "success" : "error");
    });

    document.querySelector("[data-copy-pix-key]")?.addEventListener("click", async () => {
        const ok = await copyValue(PIX_KEY);
        setPixStatus(ok ? "Chave PIX copiada." : "Nao consegui copiar automaticamente. Copie a chave exibida.", ok ? "success" : "error");
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            setMenuState(false);
            if (loginModal?.classList.contains("is-open")) {
                closeLogin();
            }
            if (pixModal?.classList.contains("is-open")) {
                closePix();
            }
        }
    });

    const activateTab = (button) => {
        const targetId = button.dataset.tabTarget;
        const targetPanel = document.getElementById(targetId);

        tabButtons.forEach((tab) => {
            const isActive = tab === button;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", String(isActive));
        });

        document.querySelectorAll(".pricing-content").forEach((panel) => {
            const isActive = panel === targetPanel;
            panel.classList.toggle("is-active", isActive);
            panel.hidden = !isActive;
        });

        if (targetPanel) {
            targetPanel.querySelectorAll("[data-reveal]").forEach((item, index) => {
                item.style.setProperty("--reveal-delay", `${index * 80}ms`);
                if (prefersReducedMotion) {
                    item.classList.add("is-visible");
                    return;
                }

                item.classList.remove("is-visible");
                window.setTimeout(() => item.classList.add("is-visible"), 30);
            });
        }
    };

    tabButtons.forEach((button) => {
        button.addEventListener("click", () => activateTab(button));
    });

    revealItems.forEach((item, index) => {
        const isPortrait = item.classList.contains("patricio-portrait");
        const isCopy = item.matches(".section-heading, .about-copy, .depth-copy, .creative-panel, .final-panel, .patricio-copy");
        const isCard = item.matches(".quick-panel, .service-card, .pricing-card, .client-card, .process-step");
        const direction = index % 2 === 0 ? -1 : 1;

        item.style.setProperty("--reveal-x", isPortrait ? "58px" : isCopy ? "-48px" : isCard ? `${direction * 22}px` : "0px");
        item.style.setProperty("--reveal-y", isCopy || isPortrait ? "12px" : isCard ? "46px" : "32px");
        item.style.setProperty("--reveal-z", isCard ? "-44px" : "-24px");
        item.style.setProperty("--reveal-rx", isCard ? "5deg" : "3deg");
        item.style.setProperty("--reveal-rz", isCard ? `${direction * .7}deg` : "0deg");
        item.style.setProperty("--reveal-scale", isCard ? ".965" : ".985");
    });

    revealGroups.forEach((group) => {
        group.querySelectorAll("[data-reveal]").forEach((item, index) => {
            item.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 95}ms`);
        });
    });

    if (!prefersReducedMotion && "IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -12% 0px" });

        revealItems.forEach((item) => revealObserver.observe(item));
    } else {
        revealItems.forEach((item) => item.classList.add("is-visible"));
    }

    const interactiveTargets = document.querySelectorAll("a, button:not(.menu-toggle), .quick-panel, .service-card, .pricing-card, .client-card, .creative-card, .process-step, .impact-card");

    if (!prefersReducedMotion) {
        interactiveTargets.forEach((element) => {
            element.addEventListener("pointerdown", (event) => {
                if (event.button && event.button !== 0) return;

                const rect = element.getBoundingClientRect();
                const spark = document.createElement("span");

                spark.className = "click-spark";
                spark.style.left = `${event.clientX - rect.left}px`;
                spark.style.top = `${event.clientY - rect.top}px`;

                if (getComputedStyle(element).position === "static") {
                    element.style.position = "relative";
                }

                element.classList.add("is-pressing");
                element.appendChild(spark);

                window.setTimeout(() => spark.remove(), 540);
            });

            element.addEventListener("pointerup", () => element.classList.remove("is-pressing"));
            element.addEventListener("pointerleave", () => element.classList.remove("is-pressing"));
            element.addEventListener("pointercancel", () => element.classList.remove("is-pressing"));
        });
    }

    window.openLogin = openLogin;
    window.closeLogin = closeLogin;
});
