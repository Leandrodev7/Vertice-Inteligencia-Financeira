/* =========================================================
   VÉRTICE | INTELIGÊNCIA FINANCEIRA
   Cadastro e leitura de investimentos no Supabase
   ========================================================= */

(() => {
  "use strict";

  const VAZIO = "-";

  const dinheiro = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const dataBR = (valor) => {
    if (!valor) return VAZIO;

    const data = new Date(`${String(valor).slice(0, 10)}T12:00:00`);

    if (Number.isNaN(data.getTime())) return VAZIO;

    return data.toLocaleDateString("pt-BR");
  };

  const valorBR = (valor) => {
    const numero = Number(valor);

    return Number.isFinite(numero) ? dinheiro.format(numero) : VAZIO;
  };

  const taxaBR = (valor) => {
    if (valor === null || valor === undefined || valor === "") {
      return VAZIO;
    }

    return `${Number(valor).toLocaleString("pt-BR")}%`;
  };

  const escaparHTML = (valor) =>
    String(valor ?? "").replace(
      /[&<>"']/g,
      (caractere) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[caractere],
    );

  // Cor do ícone de cada tipo (classes que já existem no style.css)
  const CORES_ICONE = {
    CDB: "green-bg",
    "Tesouro Direto": "purple-bg",
    LCI: "orange-bg",
    LCA: "orange-bg",
  };

  // Rentabilidade exibida: taxa + indexador (ex.: 100% CDI)
  function rentabilidadeBR(item) {
    const taxa = taxaBR(item.taxa_percentual);

    if (taxa === VAZIO) return VAZIO;

    return item.indexador ? `${taxa} ${item.indexador}` : taxa;
  }

  // Situação calculada pela data de vencimento
  function situacaoDoInvestimento(item) {
    const ativo = { texto: "Ativo", classe: "status-active" };

    if (!item.data_vencimento) return ativo;

    const vencimento = new Date(
      `${String(item.data_vencimento).slice(0, 10)}T12:00:00`,
    );

    if (Number.isNaN(vencimento.getTime())) return ativo;

    const dias = Math.ceil((vencimento - new Date()) / 86400000);

    if (dias < 0) return { texto: "Vencido", classe: "status-attention" };
    if (dias <= 90) return { texto: "A vencer", classe: "status-attention" };

    return ativo;
  }

  function iniciarAplicacao() {
    // Os ids abaixo precisam ser iguais aos do index.html
    const tabela = document.querySelector("#investment-table");
    const estadoVazio = document.querySelector("#empty-state");
    const botaoNovo = document.querySelector("#add-investment");
    const botaoExportar = document.querySelector("#export-button");
    const campoPesquisa = document.querySelector("#investment-search");

    let investimentos = [];
    let usuarioAtual = null;
    let clienteSupabase = null;

    window.verticeInvestimentos = investimentos;

    // -----------------------------------------------------
    // Navegação (só marca o link ativo, a rolagem é do href)
    // -----------------------------------------------------

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach((item) => {
          item.classList.remove("active");
        });

        link.classList.add("active");
      });
    });

    // -----------------------------------------------------
    // Mensagens
    // -----------------------------------------------------

    function mensagem(texto, tipo = "info") {
      let aviso = document.querySelector("#vertice-aviso");

      if (!aviso) {
        aviso = document.createElement("div");
        aviso.id = "vertice-aviso";

        Object.assign(aviso.style, {
          position: "fixed",
          right: "20px",
          bottom: "20px",
          zIndex: "100001",
          maxWidth: "min(420px, calc(100vw - 40px))",
          padding: "14px 18px",
          borderRadius: "10px",
          background: "#172033",
          color: "#ffffff",
          border: "1px solid #374151",
          boxShadow: "0 8px 30px #0003",
          fontSize: "14px",
          lineHeight: "1.5",
        });

        document.body.appendChild(aviso);
      }

      aviso.textContent = texto;
      aviso.style.display = "block";
      aviso.style.borderColor = tipo === "erro" ? "#ef4444" : "#374151";

      window.clearTimeout(mensagem.temporizador);

      mensagem.temporizador = window.setTimeout(() => {
        aviso.style.display = "none";
      }, 6000);
    }

    // -----------------------------------------------------
    // Formulário de novo investimento
    // -----------------------------------------------------

    function prepararFormulario() {
      if (document.querySelector("#vertice-modal-investimento")) return;

      const estilos = document.createElement("style");

      estilos.textContent = `
        #vertice-modal-investimento {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(0, 0, 0, .72);
        }

        #vertice-modal-investimento.aberto {
          display: flex;
        }

        #vertice-modal-investimento .vertice-modal-card {
          width: 100%;
          max-width: 620px;
          max-height: 92vh;
          overflow-y: auto;
          padding: 24px;
          border: 1px solid #374151;
          border-radius: 16px;
          background: #111827;
          color: #f9fafb;
          box-shadow: 0 20px 60px #0007;
        }

        #vertice-modal-investimento .vertice-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        #vertice-modal-investimento .vertice-campo {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        #vertice-modal-investimento .vertice-campo label {
          font-size: 13px;
          color: #d1d5db;
        }

        #vertice-modal-investimento .vertice-campo input,
        #vertice-modal-investimento .vertice-campo select {
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

        #vertice-modal-investimento .vertice-acoes {
          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
        }

        #vertice-modal-investimento .vertice-erro {
          display: none;
          margin-top: 16px;
          padding: 12px;
          border: 1px solid #ef4444;
          border-radius: 8px;
          color: #fecaca;
          font-size: 13px;
          line-height: 1.5;
        }

        #vertice-modal-investimento .vertice-botao {
          min-height: 40px;
          padding: 10px 16px;
          border: 1px solid #4b5563;
          border-radius: 8px;
          cursor: pointer;
          font: inherit;
        }

        #vertice-modal-investimento .vertice-salvar {
          border-color: #2563eb;
          background: #2563eb;
          color: white;
        }

        #vertice-modal-investimento .vertice-cancelar {
          background: #1f2937;
          color: white;
        }

        @media (max-width: 520px) {
          #vertice-modal-investimento .vertice-form-grid {
            grid-template-columns: 1fr;
          }

          #vertice-modal-investimento .vertice-modal-card {
            padding: 18px;
          }
        }
      `;

      document.head.appendChild(estilos);

      const modal = document.createElement("div");

      modal.id = "vertice-modal-investimento";

      modal.innerHTML = `
        <div class="vertice-modal-card" role="dialog"
             aria-modal="true" aria-labelledby="vertice-form-titulo">
          <h2 id="vertice-form-titulo">Novo investimento</h2>
          <p style="color:#9ca3af;font-size:14px;line-height:1.5">
            Preencha os dados do investimento. Os campos com * são obrigatórios.
          </p>

          <form id="vertice-form-investimento">
            <div class="vertice-form-grid">
              <div class="vertice-campo">
                <label for="vertice-nome">Nome do investimento *</label>
                <input id="vertice-nome" name="nome"
                       placeholder="Ex.: LCI Banco X" required maxlength="150">
              </div>

              <div class="vertice-campo">
                <label for="vertice-tipo">Tipo *</label>
                <select id="vertice-tipo" name="tipo" required>
                  <option value="">Selecione</option>
                  <option value="CDB">CDB</option>
                  <option value="LCI">LCI</option>
                  <option value="LCA">LCA</option>
                  <option value="Tesouro Direto">Tesouro Direto</option>
                  <option value="Ações">Ações</option>
                  <option value="Fundos">Fundos</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div class="vertice-campo">
                <label for="vertice-instituicao">Instituição financeira</label>
                <input id="vertice-instituicao" name="instituicao"
                       placeholder="Ex.: Banco X" maxlength="150">
              </div>

              <div class="vertice-campo">
                <label for="vertice-valor">Valor investido (R$) *</label>
                <input id="vertice-valor" name="valor_investido"
                       type="number" min="0.01" step="0.01"
                       placeholder="1000,00" required>
              </div>

              <div class="vertice-campo">
                <label for="vertice-taxa">Taxa (%)</label>
                <input id="vertice-taxa" name="taxa_percentual"
                       type="number" min="0" step="0.01"
                       placeholder="Ex.: 100">
              </div>

              <div class="vertice-campo">
                <label for="vertice-indexador">Indexador</label>
                <select id="vertice-indexador" name="indexador">
                  <option value="">Não informado</option>
                  <option value="CDI">CDI</option>
                  <option value="IPCA">IPCA</option>
                  <option value="Selic">Selic</option>
                  <option value="Prefixado">Prefixado</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div class="vertice-campo">
                <label for="vertice-aplicacao">Data da aplicação</label>
                <input id="vertice-aplicacao" name="data_aplicacao"
                       type="date">
              </div>

              <div class="vertice-campo">
                <label for="vertice-vencimento">Data de vencimento</label>
                <input id="vertice-vencimento" name="data_vencimento"
                       type="date">
              </div>
            </div>

            <div id="vertice-form-erro" class="vertice-erro"
                 role="alert"></div>

            <div class="vertice-acoes">
              <button type="button" id="vertice-fechar-form"
                      class="vertice-botao vertice-cancelar">
                Cancelar
              </button>

              <button type="submit" id="vertice-salvar-form"
                      class="vertice-botao vertice-salvar">
                Salvar investimento
              </button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(modal);

      const formulario = modal.querySelector("#vertice-form-investimento");

      function mostrarErroFormulario(texto) {
        const elemento = modal.querySelector("#vertice-form-erro");
        elemento.textContent = texto;
        elemento.style.display = texto ? "block" : "none";
      }

      function fecharFormulario() {
        modal.classList.remove("aberto");
        formulario.reset();
        mostrarErroFormulario("");
      }

      modal
        .querySelector("#vertice-fechar-form")
        .addEventListener("click", fecharFormulario);

      modal.addEventListener("click", (evento) => {
        if (evento.target === modal) fecharFormulario();
      });

      document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") fecharFormulario();
      });

      formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const botaoSalvar = modal.querySelector("#vertice-salvar-form");
        const nome = formulario.elements.nome.value.trim();
        const tipo = formulario.elements.tipo.value;
        const valor = Number(formulario.elements.valor_investido.value);
        const taxaTexto = formulario.elements.taxa_percentual.value;
        const dataAplicacao = formulario.elements.data_aplicacao.value;
        const dataVencimento = formulario.elements.data_vencimento.value;

        if (!nome || !tipo || !Number.isFinite(valor) || valor <= 0) {
          mostrarErroFormulario(
            "Confira o nome, o tipo e o valor do investimento.",
          );
          return;
        }

        if (
          taxaTexto !== "" &&
          (!Number.isFinite(Number(taxaTexto)) || Number(taxaTexto) < 0)
        ) {
          mostrarErroFormulario("Confira o valor da taxa.");
          return;
        }

        if (dataAplicacao && dataVencimento && dataVencimento < dataAplicacao) {
          mostrarErroFormulario(
            "A data de vencimento não pode ser anterior à data da aplicação.",
          );
          return;
        }

        if (!clienteSupabase || !usuarioAtual) {
          mostrarErroFormulario(
            "Sua sessão não foi identificada. Entre novamente na sua conta.",
          );
          return;
        }

        const registro = {
          user_id: usuarioAtual.id,
          nome,
          tipo,
          instituicao: formulario.elements.instituicao.value.trim() || null,
          valor_investido: valor,
          taxa_percentual: taxaTexto === "" ? null : Number(taxaTexto),
          indexador: formulario.elements.indexador.value || null,
          data_aplicacao: dataAplicacao || null,
          data_vencimento: dataVencimento || null,
        };

        botaoSalvar.disabled = true;
        botaoSalvar.textContent = "Salvando...";
        mostrarErroFormulario("");

        try {
          const { error } = await clienteSupabase
            .from("investimentos")
            .insert(registro);

          if (error) {
            console.error("Erro ao salvar investimento:", error);
            mostrarErroFormulario(interpretarErroSupabase(error));
            return;
          }

          fecharFormulario();

          const recarregou = await carregarInvestimentos();

          // Só avisa que deu certo se a lista também atualizou.
          // Se a leitura falhar, o aviso de erro dela continua na tela.
          if (recarregou) {
            mensagem("Investimento salvo com sucesso.");
          }
        } catch (erro) {
          console.error("Erro inesperado ao salvar:", erro);
          mostrarErroFormulario(
            "Não foi possível salvar. Tente novamente e, se continuar, envie a mensagem de erro ao professor.",
          );
        } finally {
          botaoSalvar.disabled = false;
          botaoSalvar.textContent = "Salvar investimento";
        }
      });

      modal.abrir = () => {
        modal.classList.add("aberto");
        mostrarErroFormulario("");
        modal.querySelector("#vertice-nome").focus();
      };
    }

    // -----------------------------------------------------
    // Filtro da tabela (busca) e mensagem de lista vazia
    // -----------------------------------------------------

    function aplicarFiltro() {
      if (!tabela) return;

      const termo = campoPesquisa
        ? campoPesquisa.value.trim().toLocaleLowerCase("pt-BR")
        : "";

      let visiveis = 0;

      tabela.querySelectorAll("tr").forEach((linha) => {
        const mostrar = linha.textContent
          .toLocaleLowerCase("pt-BR")
          .includes(termo);

        linha.hidden = !mostrar;

        if (mostrar) visiveis += 1;
      });

      if (!estadoVazio) return;

      if (investimentos.length === 0) {
        estadoVazio.textContent = "Nenhum investimento cadastrado ainda.";
        estadoVazio.hidden = false;
      } else if (visiveis === 0) {
        estadoVazio.textContent =
          "Nenhum investimento encontrado com esse nome.";
        estadoVazio.hidden = false;
      } else {
        estadoVazio.hidden = true;
      }
    }

    // -----------------------------------------------------
    // Atualizar tabela com dados reais
    // -----------------------------------------------------

    function atualizarTabela() {
      if (!tabela) return;

      window.verticeInvestimentos = investimentos;

      tabela.innerHTML = "";

      investimentos.forEach((item) => {
        const linha = document.createElement("tr");

        const nome = escaparHTML(item.nome || "Sem nome");
        const instituicao = escaparHTML(
          item.instituicao || "Instituição não informada",
        );
        const tipo = escaparHTML(item.tipo || VAZIO);
        const letra = escaparHTML(
          String(item.tipo || item.nome || "?")
            .charAt(0)
            .toLocaleUpperCase("pt-BR"),
        );
        const corIcone = CORES_ICONE[item.tipo] || "green-bg";
        const valor = escaparHTML(valorBR(item.valor_investido));
        const rentabilidade = escaparHTML(rentabilidadeBR(item));
        const vencimento = escaparHTML(dataBR(item.data_vencimento));
        const situacao = situacaoDoInvestimento(item);
        const idItem = escaparHTML(item.id);

        linha.innerHTML = `
          <td>
            <div class="product-name">
              <span class="product-icon ${corIcone}">${letra}</span>
              <div>
                <strong>${nome}</strong>
                <small>${instituicao} · ${tipo}</small>
              </div>
            </div>
          </td>
          <td>${valor}</td>
          <td class="positive">${rentabilidade}</td>
          <td>${vencimento}</td>
          <td>
            <span class="status-pill ${situacao.classe}">${situacao.texto}</span>
            <button type="button" data-excluir="${idItem}"
                    aria-label="Excluir ${nome}"
                    style="margin-left:8px;padding:4px 10px;border:1px solid #ef4444;border-radius:8px;background:transparent;color:#fca5a5;font:inherit;font-size:12px;cursor:pointer">
              Excluir
            </button>
          </td>
        `;

        tabela.appendChild(linha);
      });

      const rodape = document.querySelector(".table-footer");

      if (rodape) {
        const textos = rodape.querySelectorAll("span");

        if (textos[0]) {
          textos[0].textContent = `${investimentos.length} investimento(s) cadastrado(s)`;
        }

        if (textos[1]) {
          textos[1].textContent = "Dados carregados da sua conta.";
        }
      }

      aplicarFiltro();
    }

    // -----------------------------------------------------
    // Carregar investimentos do Supabase
    // Devolve true se carregou, false se deu erro
    // -----------------------------------------------------

    async function carregarInvestimentos() {
      if (!clienteSupabase || !usuarioAtual) return false;

      if (tabela) {
        tabela.innerHTML = `
          <tr>
            <td colspan="5">Carregando investimentos...</td>
          </tr>
        `;
      }

      try {
        const { data, error } = await clienteSupabase
          .from("investimentos")
          .select("*")
          .eq("user_id", usuarioAtual.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao consultar investimentos:", error);

          investimentos = [];
          atualizarTabela();

          mensagem(
            "Não foi possível carregar os investimentos. Veja o console (F12).",
            "erro",
          );

          return false;
        }

        investimentos = Array.isArray(data) ? data : [];
        atualizarTabela();

        return true;
      } catch (erro) {
        console.error("Erro inesperado ao carregar:", erro);
        mensagem("Ocorreu um erro ao carregar os investimentos.", "erro");

        return false;
      }
    }

    // -----------------------------------------------------
    // Conectar ao Supabase
    // -----------------------------------------------------

    async function iniciarIntegracaoSupabase() {
      clienteSupabase = window.verticeSupabase;

      if (!clienteSupabase) {
        console.error(
          "Supabase não encontrado. Confira se supabase.js carrega antes de script.js.",
        );

        mensagem(
          "A conexão com o Supabase não foi encontrada. Confira os arquivos de configuração.",
          "erro",
        );

        return;
      }

      try {
        const { data } = await clienteSupabase.auth.getSession();

        usuarioAtual = data?.session?.user || null;

        if (usuarioAtual) {
          await carregarInvestimentos();
        } else {
          investimentos = [];
          atualizarTabela();
        }

        clienteSupabase.auth.onAuthStateChange((evento, sessao) => {
          usuarioAtual = sessao?.user || null;

          if (evento === "SIGNED_IN" && usuarioAtual) {
            // Evita iniciar chamadas Supabase dentro do callback de autenticação.
            setTimeout(() => carregarInvestimentos(), 0);
          }

          if (evento === "SIGNED_OUT") {
            investimentos = [];
            atualizarTabela();
          }
        });
      } catch (erro) {
        console.error("Falha ao iniciar Supabase:", erro);

        mensagem(
          "Não foi possível iniciar a conexão com o banco de dados.",
          "erro",
        );
      }
    }

    // -----------------------------------------------------
    // Excluir investimento
    // -----------------------------------------------------

    async function excluirInvestimento(id) {
      if (!clienteSupabase || !usuarioAtual) {
        mensagem("Sua sessão não foi identificada. Entre novamente.", "erro");
        return;
      }

      const item = investimentos.find((registro) => registro.id === id);
      const nome = item?.nome || "este investimento";

      if (!window.confirm(`Excluir "${nome}"? Isso não pode ser desfeito.`)) {
        return;
      }

      try {
        // O .select() devolve as linhas apagadas. Se vier vazio, o banco
        // não apagou nada (normalmente falta a política de DELETE).
        const { data, error } = await clienteSupabase
          .from("investimentos")
          .delete()
          .eq("id", id)
          .eq("user_id", usuarioAtual.id)
          .select();

        if (error) {
          console.error("Erro ao excluir investimento:", error);
          mensagem(`Não foi possível excluir: ${error.message}`, "erro");
          return;
        }

        if (!data || data.length === 0) {
          mensagem(
            "Nada foi excluído. Confira se a política de DELETE existe no Supabase.",
            "erro",
          );
          return;
        }

        const recarregou = await carregarInvestimentos();

        if (recarregou) {
          mensagem("Investimento excluído.");
        }
      } catch (erro) {
        console.error("Erro inesperado ao excluir:", erro);
        mensagem("Ocorreu um erro ao excluir o investimento.", "erro");
      }
    }

    function interpretarErroSupabase(erro) {
      const mensagemErro = String(erro?.message || "").toLowerCase();

      if (
        erro?.code === "42501" ||
        mensagemErro.includes("row-level security") ||
        mensagemErro.includes("permission denied")
      ) {
        return "O Supabase bloqueou a gravação por segurança. Precisamos conferir a política de INSERT da tabela investimentos. Não desative o RLS.";
      }

      if (
        mensagemErro.includes("instituicao") &&
        (mensagemErro.includes("column") ||
          mensagemErro.includes("schema cache"))
      ) {
        return "O nome da coluna da instituição no banco parece diferente de 'instituicao'. Precisamos conferir o nome exato no Supabase.";
      }

      if (
        mensagemErro.includes("does not exist") ||
        mensagemErro.includes("schema cache")
      ) {
        return "Uma tabela ou coluna não foi encontrada. Confira os nomes das colunas da tabela investimentos no Supabase.";
      }

      return `Não foi possível salvar: ${erro?.message || "erro desconhecido"}`;
    }

    // -----------------------------------------------------
    // Botão de cadastro
    // -----------------------------------------------------

    if (botaoNovo) {
      botaoNovo.addEventListener("click", () => {
        prepararFormulario();

        const modal = document.querySelector("#vertice-modal-investimento");

        if (modal?.abrir) {
          modal.abrir();
        }
      });
    }

    // -----------------------------------------------------
    // Exportar os investimentos reais para CSV
    // -----------------------------------------------------

    if (botaoExportar) {
      botaoExportar.addEventListener("click", () => {
        if (investimentos.length === 0) {
          mensagem("Não há investimentos cadastrados para exportar.");
          return;
        }

        const colunas = [
          ["nome", "Nome"],
          ["tipo", "Tipo"],
          ["instituicao", "Instituição"],
          ["valor_investido", "Valor investido"],
          ["taxa_percentual", "Taxa percentual"],
          ["indexador", "Indexador"],
          ["data_aplicacao", "Data da aplicação"],
          ["data_vencimento", "Data de vencimento"],
        ];

        const csv = [
          colunas.map((coluna) => coluna[1]).join(";"),
          ...investimentos.map((item) =>
            colunas
              .map(([chave]) => {
                let valor = item[chave] ?? "";

                if (chave === "valor_investido" && valor !== "") {
                  valor = Number(valor).toFixed(2).replace(".", ",");
                }

                valor = String(valor).replace(/"/g, '""');

                return `"${valor}"`;
              })
              .join(";"),
          ),
        ].join("\r\n");

        const arquivo = new Blob(["\uFEFF", csv], {
          type: "text/csv;charset=utf-8;",
        });

        const url = URL.createObjectURL(arquivo);
        const link = document.createElement("a");

        link.href = url;
        link.download = "vertice-investimentos.csv";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        mensagem("Arquivo CSV exportado.");
      });
    }

    // -----------------------------------------------------
    // Pesquisa na tabela
    // -----------------------------------------------------

    if (campoPesquisa) {
      campoPesquisa.addEventListener("input", aplicarFiltro);
    }

    // -----------------------------------------------------
    // Cliques nos botões Excluir
    // -----------------------------------------------------

    if (tabela) {
      tabela.addEventListener("click", (evento) => {
        const botao = evento.target.closest("[data-excluir]");

        if (!botao) return;

        excluirInvestimento(botao.dataset.excluir);
      });
    }

    // -----------------------------------------------------
    // Gráficos demonstrativos existentes
    // -----------------------------------------------------

    if (typeof Chart !== "undefined") {
      document.querySelectorAll("canvas").forEach((canvas) => {
        if (Chart.getChart(canvas)) return;

        const contexto = canvas.getContext("2d");
        if (!contexto) return;

        const tipo = canvas.dataset.chartType || "line";

        const rotulos = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];

        new Chart(contexto, {
          type: tipo,
          data: {
            labels: rotulos,
            datasets: [
              {
                label: "Demonstração",
                data: [12, 19, 15, 24, 21, 30],
                borderColor: "#60a5fa",
                backgroundColor:
                  tipo === "line"
                    ? "rgba(96,165,250,.15)"
                    : [
                        "#60a5fa",
                        "#34d399",
                        "#fbbf24",
                        "#a78bfa",
                        "#f87171",
                        "#38bdf8",
                      ],
                borderWidth: 2,
                tension: 0.35,
                fill: tipo === "line",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: tipo !== "line",
              },
            },
          },
        });
      });
    }

    // -----------------------------------------------------
    // Inicialização
    // -----------------------------------------------------

    prepararFormulario();
    iniciarIntegracaoSupabase();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarAplicacao);
  } else {
    iniciarAplicacao();
  }
})();
