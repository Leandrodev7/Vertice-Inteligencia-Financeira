/* =========================================================
   VÉRTICE | INTELIGÊNCIA FINANCEIRA
   Login, criação de conta e saída (Supabase Auth)
   Este arquivo só cuida da conta. A lista de investimentos
   continua no script.js, que reage ao login sozinho.
   ========================================================= */

(() => {
  "use strict";

  function iniciar() {
    const cliente = window.verticeSupabase;

    if (!cliente) {
      console.error(
        "Supabase não encontrado. Confira se supabase.js carrega antes de auth.js.",
      );
      return;
    }

    let usuario = null;

    // -----------------------------------------------------
    // Estilos do modal de login
    // -----------------------------------------------------

    const estilos = document.createElement("style");

    estilos.textContent = `
      #vertice-conta {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      #vertice-conta-email {
        max-width: 190px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
        color: #9ca3af;
      }

      #vertice-modal-login {
        position: fixed;
        inset: 0;
        z-index: 10001;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(0, 0, 0, .72);
      }

      #vertice-modal-login.aberto {
        display: flex;
      }

      #vertice-modal-login .vertice-login-card {
        width: 100%;
        max-width: 400px;
        padding: 24px;
        border: 1px solid #374151;
        border-radius: 16px;
        background: #111827;
        color: #f9fafb;
        box-shadow: 0 20px 60px #0007;
      }

      #vertice-modal-login .vertice-login-campo {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-top: 16px;
      }

      #vertice-modal-login label {
        font-size: 13px;
        color: #d1d5db;
      }

      #vertice-modal-login input {
        box-sizing: border-box;
        width: 100%;
        min-height: 43px;
        padding: 10px;
        border: 1px solid #4b5563;
        border-radius: 8px;
        background: #1f2937;
        color: #f9fafb;
        font: inherit;
      }

      #vertice-modal-login .vertice-login-msg {
        display: none;
        margin-top: 16px;
        padding: 12px;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.5;
      }

      #vertice-modal-login .vertice-login-msg.erro {
        display: block;
        border: 1px solid #ef4444;
        color: #fecaca;
      }

      #vertice-modal-login .vertice-login-msg.ok {
        display: block;
        border: 1px solid #22c55e;
        color: #bbf7d0;
      }

      #vertice-modal-login .vertice-login-acoes {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 24px;
      }

      #vertice-modal-login .vertice-login-botao {
        min-height: 40px;
        padding: 10px 16px;
        border: 1px solid #4b5563;
        border-radius: 8px;
        background: #1f2937;
        color: #ffffff;
        cursor: pointer;
        font: inherit;
      }

      #vertice-modal-login .vertice-login-botao:disabled {
        opacity: .6;
        cursor: wait;
      }

      #vertice-modal-login .vertice-login-entrar {
        border-color: #2563eb;
        background: #2563eb;
      }
    `;

    document.head.appendChild(estilos);

    // -----------------------------------------------------
    // Botão Entrar / Sair no topo da página
    // -----------------------------------------------------

    const caixaConta = document.createElement("div");

    caixaConta.id = "vertice-conta";

    caixaConta.innerHTML = `
      <span id="vertice-conta-email"></span>
      <button type="button" id="vertice-conta-botao"
              class="button button-secondary">Entrar</button>
    `;

    const areaTopo = document.querySelector(".topbar-right");

    if (areaTopo) {
      areaTopo.insertBefore(caixaConta, areaTopo.firstChild);
    } else {
      Object.assign(caixaConta.style, {
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: "10000",
      });

      document.body.appendChild(caixaConta);
    }

    const textoEmail = caixaConta.querySelector("#vertice-conta-email");
    const botaoConta = caixaConta.querySelector("#vertice-conta-botao");

    // -----------------------------------------------------
    // Modal de login
    // -----------------------------------------------------

    const modal = document.createElement("div");

    modal.id = "vertice-modal-login";

    modal.innerHTML = `
      <div class="vertice-login-card" role="dialog" aria-modal="true"
           aria-labelledby="vertice-login-titulo">
        <h2 id="vertice-login-titulo">Entrar no Vértice</h2>
        <p style="color:#9ca3af;font-size:14px;line-height:1.5">
          Use o e-mail da sua conta para ver seus investimentos.
        </p>

        <form id="vertice-login-form">
          <div class="vertice-login-campo">
            <label for="vertice-login-email">E-mail</label>
            <input id="vertice-login-email" type="email"
                   autocomplete="email" required>
          </div>

          <div class="vertice-login-campo">
            <label for="vertice-login-senha">Senha</label>
            <input id="vertice-login-senha" type="password"
                   autocomplete="current-password" minlength="6" required>
          </div>

          <div id="vertice-login-msg" class="vertice-login-msg"
               role="alert"></div>

          <div class="vertice-login-acoes">
            <button type="button" id="vertice-login-cancelar"
                    class="vertice-login-botao">Cancelar</button>
            <button type="button" id="vertice-login-criar"
                    class="vertice-login-botao">Criar conta</button>
            <button type="submit" id="vertice-login-entrar"
                    class="vertice-login-botao vertice-login-entrar">Entrar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const formulario = modal.querySelector("#vertice-login-form");
    const campoEmail = modal.querySelector("#vertice-login-email");
    const campoSenha = modal.querySelector("#vertice-login-senha");
    const caixaMsg = modal.querySelector("#vertice-login-msg");
    const botaoEntrar = modal.querySelector("#vertice-login-entrar");
    const botaoCriar = modal.querySelector("#vertice-login-criar");
    const botaoCancelar = modal.querySelector("#vertice-login-cancelar");

    function mostrarMsg(texto, tipo = "erro") {
      caixaMsg.textContent = texto;
      caixaMsg.className = texto
        ? `vertice-login-msg ${tipo}`
        : "vertice-login-msg";
    }

    function abrirModal() {
      mostrarMsg("");
      modal.classList.add("aberto");
      campoEmail.focus();
    }

    function fecharModal() {
      modal.classList.remove("aberto");
      campoSenha.value = "";
      mostrarMsg("");
    }

    function ocupado(estaOcupado) {
      botaoEntrar.disabled = estaOcupado;
      botaoCriar.disabled = estaOcupado;
    }

    function traduzirErro(erro) {
      const texto = String(erro?.message || "").toLowerCase();

      if (texto.includes("invalid login credentials")) {
        return "E-mail ou senha incorretos.";
      }

      if (texto.includes("email not confirmed")) {
        return "Seu e-mail ainda não foi confirmado. Abra o e-mail que o Supabase enviou e clique no link.";
      }

      if (texto.includes("already registered")) {
        return "Esse e-mail já tem conta. Use o botão Entrar.";
      }

      if (texto.includes("password should be at least")) {
        return "A senha precisa ter pelo menos 6 caracteres.";
      }

      if (texto.includes("rate limit") || texto.includes("too many")) {
        return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
      }

      return `Não foi possível concluir: ${erro?.message || "erro desconhecido"}`;
    }

    // -----------------------------------------------------
    // Ações: entrar, criar conta, sair
    // -----------------------------------------------------

    async function entrar() {
      const email = campoEmail.value.trim();
      const senha = campoSenha.value;

      if (!email || !senha) {
        mostrarMsg("Preencha o e-mail e a senha.");
        return;
      }

      ocupado(true);
      mostrarMsg("");

      try {
        const { error } = await cliente.auth.signInWithPassword({
          email,
          password: senha,
        });

        if (error) {
          console.error("Erro ao entrar:", error);
          mostrarMsg(traduzirErro(error));
          return;
        }

        fecharModal();
      } catch (erro) {
        console.error("Erro inesperado ao entrar:", erro);
        mostrarMsg("Ocorreu um erro ao entrar. Tente novamente.");
      } finally {
        ocupado(false);
      }
    }

    async function criarConta() {
      const email = campoEmail.value.trim();
      const senha = campoSenha.value;

      if (!email || senha.length < 6) {
        mostrarMsg(
          "Informe um e-mail e uma senha com pelo menos 6 caracteres.",
        );
        return;
      }

      ocupado(true);
      mostrarMsg("");

      try {
        const { data, error } = await cliente.auth.signUp({
          email,
          password: senha,
        });

        if (error) {
          console.error("Erro ao criar conta:", error);
          mostrarMsg(traduzirErro(error));
          return;
        }

        if (data?.session) {
          fecharModal();
        } else {
          mostrarMsg(
            "Conta criada. Confira seu e-mail, confirme o cadastro e depois clique em Entrar.",
            "ok",
          );
        }
      } catch (erro) {
        console.error("Erro inesperado ao criar conta:", erro);
        mostrarMsg("Ocorreu um erro ao criar a conta. Tente novamente.");
      } finally {
        ocupado(false);
      }
    }

    async function sair() {
      try {
        const { error } = await cliente.auth.signOut();

        if (error) {
          console.error("Erro ao sair:", error);
        }
      } catch (erro) {
        console.error("Erro inesperado ao sair:", erro);
      }
    }

    // -----------------------------------------------------
    // Atualizar o topo conforme o estado do login
    // -----------------------------------------------------

    function atualizarTopo(novoUsuario) {
      usuario = novoUsuario || null;

      if (usuario) {
        textoEmail.textContent = usuario.email || "";
        botaoConta.textContent = "Sair";
      } else {
        textoEmail.textContent = "";
        botaoConta.textContent = "Entrar";
      }
    }

    // -----------------------------------------------------
    // Eventos
    // -----------------------------------------------------

    botaoConta.addEventListener("click", () => {
      if (usuario) {
        sair();
      } else {
        abrirModal();
      }
    });

    formulario.addEventListener("submit", (evento) => {
      evento.preventDefault();
      entrar();
    });

    botaoCriar.addEventListener("click", criarConta);
    botaoCancelar.addEventListener("click", fecharModal);

    modal.addEventListener("click", (evento) => {
      if (evento.target === modal) fecharModal();
    });

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") fecharModal();
    });

    // -----------------------------------------------------
    // Estado inicial e mudanças de login
    // -----------------------------------------------------

    cliente.auth
      .getSession()
      .then(({ data }) => atualizarTopo(data?.session?.user))
      .catch((erro) => {
        console.error("Erro ao ler a sessão:", erro);
        atualizarTopo(null);
      });

    cliente.auth.onAuthStateChange((evento, sessao) => {
      atualizarTopo(sessao?.user);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
