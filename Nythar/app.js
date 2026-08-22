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
    const revealItems = document.querySelectorAll("[data-reveal]");
    const revealGroups = document.querySelectorAll(".quick-panel-grid, .services-grid, .pricing-grid, .clients-grid, .process-grid, .creative-grid, .impact-board");
    const PIX_KEY = document.querySelector('meta[name="nythar-pix-key"]')?.content.trim() || "";
    const SALES_WHATSAPP = (document.querySelector('meta[name="nythar-sales-whatsapp"]')?.content || "").replace(/\D/g, "");
    const PIX_MERCHANT_NAME = "NYTHAR";
    const PIX_CITY = "ANAPOLIS";
    const API_FALLBACK_BASE = "http://127.0.0.1:4000";
    let lastFocusedElement = null;

    document.querySelectorAll("[data-sales-whatsapp]").forEach((link) => {
        if (!SALES_WHATSAPP) {
            link.hidden = true;
            return;
        }
        const message = encodeURIComponent(link.dataset.whatsappMessage || "Quero conhecer a Nythar");
        link.href = `https://wa.me/${SALES_WHATSAPP}?text=${message}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
    });

    if (!prefersReducedMotion) {
        document.body.classList.add("motion-ready");
    }

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
            .find(({ section }) => section.offsetTop - 140 <= window.scrollY);

        navLinks.forEach((link) => link.classList.remove("is-active"));
        activeSection?.link.classList.add("is-active");
    };

    setActiveNav();
    window.addEventListener("scroll", setActiveNav, { passive: true });

    const openLogin = () => {
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
        const txid = `NYTHAR${Date.now().toString().slice(-12)}`.slice(0, 25);
        const merchantAccount =
            emvField("00", "br.gov.bcb.pix") +
            emvField("01", PIX_KEY) +
            emvField("02", String(description || "Assinatura Nythar").slice(0, 25));
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
        const plan = button.dataset.pixPlan || "Assinatura Nythar";
        const price = Number(button.dataset.pixPrice || 0);
        const payload = PIX_KEY ? buildPixPayload({ amount: price, description: plan }) : "";
        const whatsappText = encodeURIComponent(`Ola, fiz ou vou fazer o PIX da assinatura ${plan} da Nythar no valor de R$ ${price.toFixed(2).replace(".", ",")}. Segue o comprovante.`);

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
                ? "Pagamento via PIX manual. Depois envie o comprovante para liberar a assinatura."
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

    revealGroups.forEach((group) => {
        group.querySelectorAll("[data-reveal]").forEach((item, index) => {
            item.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 70}ms`);
        });
    });

    if (!prefersReducedMotion && "IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });

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
