import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { 
  Plus, 
  Search, 
  Filter,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Hash,
  X,
  Info,
  Edit,
  Trash2,
  Calendar,
  Activity,
  Eye
} from 'lucide-react';
import { transacoesApi, categoriasApi, contasApi, cartoesApi, parcelasApi } from '../services/api';
import { CloudArrowUpIcon, DocumentArrowDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
  import { useMutation, useQueryClient } from 'react-query'
import { useTransactionInvalidation } from '../hooks/useTransactionInvalidation';
import { useExcelExport } from '../hooks/useExcelExport';
  
  interface Transacao {
  id: number;
  descricao: string;
  valor: number;
  tipo: 'ENTRADA' | 'SAIDA';
  data: string;
  categoria_id: number;
  conta_id?: number;
  cartao_id?: number;
  observacoes?: string;
  is_parcelada?: boolean;
  numero_parcela?: number;
  total_parcelas?: number;
  compra_parcelada_id?: number;
  created_by_name?: string;
  categoria?: {
    id: number;
    nome: string;
    cor: string;
    icone: string;
  };
  conta?: {
    id: number;
    nome: string;
    banco: string;
  };
  cartao?: {
    id: number;
    nome: string;
    bandeira: string;
  };
  created_at: string;
}

interface Categoria {
  id: number;
  nome: string;
  cor: string;
  icone: string;
}

interface Conta {
  id: number;
  nome: string;
  banco: string;
}

interface Cartao {
  id: number;
  nome: string;
  bandeira: string;
}

interface Filtros {
  tipo?: 'ENTRADA' | 'SAIDA';
  categoria_id?: number;
  conta_id?: number;
  cartao_id?: number;
  data_inicio?: string;
  data_fim?: string;
  busca?: string;
}

interface Resumo {
  total_entradas: number;
  total_saidas: number;
  saldo: number;
  total_transacoes: number;
}

const Transacoes: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<Transacao | null>(null);
  
  const [filtros, setFiltros] = useState<Filtros>({
    // Definir mês atual como padrão
    data_inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    data_fim: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalTransacoes, setTotalTransacoes] = useState(0);

  // Estados do formulário
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    tipo: 'SAIDA' as 'ENTRADA' | 'SAIDA',
    data: new Date().toISOString().split('T')[0],
    categoria_id: '',
    conta_id: '',
    cartao_id: '',
    observacoes: ''
  });

  // NOVO: Estados para parcelamento
  const [isParcelado, setIsParcelado] = useState(false);
  const [formParcelamento, setFormParcelamento] = useState({
    total_parcelas: 2,
    data_primeira_parcela: new Date().toISOString().split('T')[0]
  });

  // Estados para feedback
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [showInfo, setShowInfo] = useState(false);

  const [showBulkModal, setShowBulkModal] = useState(false)
const [bulkTransactions, setBulkTransactions] = useState([{
  data: new Date().toISOString().split('T')[0],
  descricao: '',
  valor: '',
  tipo: 'SAIDA' as 'ENTRADA' | 'SAIDA',
  categoria_id: '',
  conta_id: '',
  cartao_id: '',
  observacoes: ''
}])
const [bulkResult, setBulkResult] = useState<any>(null)
const [isProcessingBulk, setIsProcessingBulk] = useState(false)
const [rawText, setRawText] = useState('')
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  
  const queryClient = useQueryClient()
  const { invalidateAfterTransactionMutation } = useTransactionInvalidation()
  const { exportTransacoes } = useExcelExport()

  // Limpar mensagens após 3 segundos
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Verificar se usuário está carregado
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  const loadTransacoes = async (reset = false) => {
    try {
      const currentPage = reset ? 0 : page;
      setLoading(reset);
      
      console.log('🔄 Loading transações:', { reset, currentPage, filtros });
      
      const response = await transacoesApi.getAll({
        skip: currentPage * 50,
        limit: 50,
        ...filtros
      });
      
      console.log('📊 Transações recebidas:', response.length);
      
      if (reset) {
        setTransacoes(response);
        setPage(1); // Próxima página será 1
        console.log('🔄 Reset: definindo', response.length, 'transações');
      } else {
        // Evitar duplicatas ao adicionar
        setTransacoes(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTransacoes = response.filter(t => !existingIds.has(t.id));
          console.log('📈 Adicionando', newTransacoes.length, 'novas transações');
          return [...prev, ...newTransacoes];
        });
        setPage(prev => prev + 1);
      }
      
      setHasMore(response.length === 50);
    } catch (error) {
      console.error('❌ Erro ao carregar transações:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const loadResumo = async () => {
    try {
      const response = await transacoesApi.getResumo({
        data_inicio: filtros.data_inicio,
        data_fim: filtros.data_fim,
        tipo: filtros.tipo,
        categoria_id: filtros.categoria_id,
        conta_id: filtros.conta_id,
        cartao_id: filtros.cartao_id,
        busca: filtros.busca
      });
      setResumo(response);
      setTotalTransacoes(response.total_transacoes);
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
    }
  };

  const loadDependencies = async () => {
    try {
      const [categoriasData, contasData, cartoesData] = await Promise.all([
        categoriasApi.getAll(),
        contasApi.getAll(),
        cartoesApi.getAll()
      ]);
      
      setCategorias(categoriasData);
      setContas(contasData);
      setCartoes(cartoesData);
    } catch (error) {
      console.error('Erro ao carregar dependências:', error);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    setLoading(true);
    setPage(0); // Reset da página
    loadTransacoes(true);
    loadResumo();
  }, [filtros]);

  // Função melhorada para carregar mais transações
  const loadMoreTransacoes = async () => {
    if (!hasMore || loading || loadingMore) return;
    
    setLoadingMore(true);
    try {
      console.log('🔄 Carregar mais - página:', page);
      const response = await transacoesApi.getAll({
        skip: page * 50,
        limit: 50,
        ...filtros
      });
      
      console.log('📊 Mais transações recebidas:', response.length);
      
      if (response.length > 0) {
        setTransacoes(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTransacoes = response.filter(t => !existingIds.has(t.id));
          console.log('📈 Adicionando', newTransacoes.length, 'novas. Total:', prev.length + newTransacoes.length);
          return [...prev, ...newTransacoes];
        });
        setPage(prev => prev + 1);
      }
      
      setHasMore(response.length === 50);
    } catch (error) {
      console.error('❌ Erro ao carregar mais transações:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação: deve ter conta OU cartão (mas não ambos)
    if (!isParcelado) {
      if (!formData.conta_id && !formData.cartao_id) {
        setErrorMessage('❌ Você deve selecionar uma Conta OU um Cartão para a transação');
        return;
      }
      
      if (formData.conta_id && formData.cartao_id) {
        setErrorMessage('❌ Você não pode selecionar Conta E Cartão ao mesmo tempo. Escolha apenas um.');
        return;
      }
    } else {
      // Para parcelamento, cartão é obrigatório
      if (!formData.cartao_id) {
        setErrorMessage('❌ Compras parceladas devem ser feitas no cartão de crédito');
        return;
      }
    }
    
    try {
      // NOVO: Verificar se é parcelamento
      if (isParcelado && formData.cartao_id && parseFloat(formData.valor) > 0) {
        // Criar compra parcelada usando API service
        const parcelamentoData = {
          descricao: formData.descricao,
          valor_total: parseFloat(formData.valor),
          total_parcelas: formParcelamento.total_parcelas,
          cartao_id: parseInt(formData.cartao_id),
          data_primeira_parcela: formParcelamento.data_primeira_parcela,
          categoria_id: parseInt(formData.categoria_id)
        };

        // Usar api service em vez de fetch direto
        await parcelasApi.create(parcelamentoData);
        
        // 🎉 NOVO: Feedback de sucesso para parcelamento
        setSuccessMessage(`✅ Parcelamento criado com sucesso!\n\n📦 ${formData.descricao}\n💰 ${formParcelamento.total_parcelas}x de R$ ${(parseFloat(formData.valor) / formParcelamento.total_parcelas).toFixed(2)}\n🎯 Total: R$ ${parseFloat(formData.valor).toFixed(2)}`);
        
      } else {
        // Criar transação normal
        const transacaoData = {
          descricao: formData.descricao,
          valor: parseFloat(formData.valor),
          tipo: formData.tipo,
          data: new Date(formData.data).toISOString(),
          categoria_id: parseInt(formData.categoria_id),
          conta_id: formData.conta_id ? parseInt(formData.conta_id) : undefined,
          cartao_id: formData.cartao_id ? parseInt(formData.cartao_id) : undefined,
          observacoes: formData.observacoes || undefined
        };

        if (editingTransacao) {
          await transacoesApi.update(editingTransacao.id, transacaoData);
          // 🎉 NOVO: Feedback para edição
          setSuccessMessage('✅ Transação atualizada com sucesso!');
        } else {
          await transacoesApi.create(transacaoData);
          // 🎉 NOVO: Feedback para criação
          setSuccessMessage('✅ Transação criada com sucesso!');
        }
      }
      
      // 🚀 NOVO: Invalidar cache do dashboard após mutação
      invalidateAfterTransactionMutation();
      
      await loadTransacoes(true);
      await loadResumo();
      setShowModal(false);
      setEditingTransacao(null);
      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      // 🚨 NOVO: Feedback de erro melhorado
      const errorMessage = error?.response?.data?.detail || error?.message || 'Erro desconhecido';
      setErrorMessage(`❌ Erro ao salvar: ${errorMessage}`);
    }
  };

  const handleEdit = (transacao: Transacao) => {
    setEditingTransacao(transacao);
    setFormData({
      descricao: transacao.descricao,
      valor: transacao.valor.toString(),
      tipo: transacao.tipo,
      data: transacao.data.split('T')[0],
      categoria_id: transacao.categoria_id.toString(),
      conta_id: transacao.conta_id?.toString() || '',
      cartao_id: transacao.cartao_id?.toString() || '',
      observacoes: transacao.observacoes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      try {
        await transacoesApi.delete(id);
        
        // 🚀 NOVO: Invalidar cache do dashboard após exclusão
        invalidateAfterTransactionMutation();
        
        loadTransacoes(true);
        loadResumo();
      } catch (error) {
        console.error('Erro ao excluir transação:', error);
      }
    }
  };

  // NOVO: Excluir parcelamento completo
  const handleDeleteParcelamento = async (transacao: Transacao) => {
    if (!transacao.compra_parcelada_id) return;

    const confirmacao = confirm(
      `🗑️ EXCLUIR PARCELAMENTO COMPLETO\n\n` +
      `📦 ${transacao.descricao}\n` +
      `📊 Parcela ${transacao.numero_parcela}/${transacao.total_parcelas}\n\n` +
      `⚠️ Esta ação excluirá TODAS as parcelas do parcelamento!\n` +
      `⚠️ Todas as transações relacionadas serão removidas!\n\n` +
      `Tem certeza que deseja continuar?`
    );

    if (!confirmacao) return;

    try {
      const result = await parcelasApi.delete(transacao.compra_parcelada_id);
      
      // 🚀 NOVO: Invalidar cache do dashboard após exclusão de parcelamento
      invalidateAfterTransactionMutation();
      
      setSuccessMessage(
        `✅ Parcelamento excluído com sucesso!\n` +
        `📦 ${transacao.descricao} foi removido\n` +
        `🗑️ ${result.detalhes?.parcelas_excluidas || 0} parcelas excluídas\n` +
        `📄 ${result.detalhes?.transacoes_excluidas || 0} transações removidas`
      );
      
      loadTransacoes(true);
      loadResumo();
    } catch (err: any) {
      console.error('Erro ao excluir parcelamento:', err);
      setErrorMessage(
        `❌ Erro ao excluir parcelamento:\n${err.response?.data?.detail || err.message}`
      );
    }
  };

  // NOVO: Editar parcelamento
  const handleEditParcelamento = async (transacao: Transacao) => {
    if (!transacao.compra_parcelada_id) return;

    // Para simplicidade, vamos navegar para a página de cartões na aba parcelamentos
    navigate('/cartoes?tab=parcelas&highlight=' + transacao.compra_parcelada_id);
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      valor: '',
      tipo: 'SAIDA',
      data: new Date().toISOString().split('T')[0],
      categoria_id: '',
      conta_id: '',
      cartao_id: '',
      observacoes: ''
    });
    // NOVO: Reset parcelamento
    setIsParcelado(false);
    setFormParcelamento({
      total_parcelas: 2,
      data_primeira_parcela: new Date().toISOString().split('T')[0]
    });
  };

  const applyFilters = (newFiltros: Filtros) => {
    setFiltros(newFiltros);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getContextoTemporal = () => {
    if (!filtros.data_inicio && !filtros.data_fim) {
      return '';
    }
    
    const hoje = new Date();
    const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fimMesAtual = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    
    if (filtros.data_inicio === mesAtual && filtros.data_fim === fimMesAtual) {
      return '(Mês Atual)';
    }
    
    if (filtros.data_inicio && filtros.data_fim) {
      const inicio = new Date(filtros.data_inicio).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      const fim = new Date(filtros.data_fim).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      return inicio === fim ? `(${inicio})` : `(${inicio} - ${fim})`;
    }
    
    if (filtros.data_inicio) {
      return `(A partir de ${new Date(filtros.data_inicio).toLocaleDateString('pt-BR')})`;
    }
    
    if (filtros.data_fim) {
      return `(Até ${new Date(filtros.data_fim).toLocaleDateString('pt-BR')})`;
    }
    
    return '';
  };

  // NOVO: Função para exportar transações para Excel
  const handleExportExcel = async () => {
    try {
      if (transacoes.length === 0) {
        setErrorMessage('❌ Nenhuma transação para exportar');
        return;
      }

      const sucesso = exportTransacoes(transacoes, filtros);
      
      if (sucesso) {
        setSuccessMessage(`✅ Excel exportado com sucesso!\n📊 ${transacoes.length} transações exportadas`);
      } else {
        setErrorMessage('❌ Erro ao exportar Excel');
      }
    } catch (error) {
      console.error('Erro na exportação:', error);
      setErrorMessage('❌ Erro ao exportar Excel');
    }
  };

  // Funções para lançamento em lote
  const addBulkRow = () => {
    setBulkTransactions([...bulkTransactions, {
      data: new Date().toISOString().split('T')[0],
      descricao: '',
      valor: '',
      tipo: 'SAIDA' as 'ENTRADA' | 'SAIDA',
      categoria_id: '',
      conta_id: '',
      cartao_id: '',
      observacoes: ''
    }])
  }

  const removeBulkRow = (index: number) => {
    if (bulkTransactions.length > 1) {
      setBulkTransactions(bulkTransactions.filter((_, i) => i !== index))
    }
  }

  const updateBulkRow = (index: number, field: string, value: string) => {
    const updated = [...bulkTransactions]
    updated[index] = { ...updated[index], [field]: value }
    setBulkTransactions(updated)
  }

  const processWithAI = async () => {
    if (!rawText.trim()) {
      alert('Digite ou cole os dados para análise')
      return
    }

    setIsProcessingAI(true)
    try {
      // Chamar novo endpoint específico para análise de extrato
      const token = localStorage.getItem('token')
      const apiUrl = 'https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api'
      
      const formData = new FormData()
      formData.append('extrato', rawText)
      
      const response = await fetch(`${apiUrl}/chat/analisar-extrato`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) throw new Error('Erro na IA')
      
      const data = await response.json()
      
      // Tentar extrair JSON da resposta
      let transactions = []
      try {
        const jsonMatch = data.resposta.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          transactions = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.error('Erro ao parsear JSON da IA:', e)
        throw new Error('IA não retornou formato válido')
      }

      // Mapear transações da IA (agora já vem com IDs corretos)
      const mappedTransactions = transactions.map(t => {
        return {
          data: t.data,
          descricao: t.descricao,
          valor: t.valor.toString(),
          tipo: t.tipo as 'ENTRADA' | 'SAIDA',
          categoria_id: t.categoria_id ? t.categoria_id.toString() : '',
          conta_id: t.conta_id ? t.conta_id.toString() : '',
          cartao_id: t.cartao_id ? t.cartao_id.toString() : '',
          observacoes: 'Processado por IA'
        }
      })

      // Substituir transações atuais
      setBulkTransactions(mappedTransactions)
      setRawText('') // Limpar campo
      
      alert(`✅ IA processou ${mappedTransactions.length} transações!`)
      
    } catch (error) {
      console.error('Erro no processamento IA:', error)
      alert('❌ Erro ao processar com IA. Tente novamente.')
    } finally {
      setIsProcessingAI(false)
    }
  }

  const processBulkTransactions = async () => {
    setIsProcessingBulk(true)
    try {
      const validTransactions = []
      const validationErrors = []
      
      for (let i = 0; i < bulkTransactions.length; i++) {
        const t = bulkTransactions[i]
        
        // Pular linhas vazias
        if (!t.descricao && !t.valor && !t.categoria_id) {
          continue
        }
        
        try {
          // Validação básica
          if (!t.descricao) {
            throw new Error('Descrição é obrigatória')
          }
          if (!t.valor) {
            throw new Error('Valor é obrigatório')
          }
                     if (!t.categoria_id) {
             throw new Error('Categoria é obrigatória')
           }
          
          // Validar se categoria existe
          const categoriaId = parseInt(t.categoria_id)
          const categoriaExiste = categorias.find(c => c.id === categoriaId)
          
          // Validar se conta existe (se fornecida)
          let contaId = undefined
          if (t.conta_id) {
            const contaIdNum = parseInt(t.conta_id)
            const contaExiste = contas.find(c => c.id === contaIdNum)
            if (contaExiste) {
              contaId = contaIdNum
            }
          }
          
          // Validar se cartão existe (se fornecido)
          let cartaoId = undefined
          if (t.cartao_id) {
            const cartaoIdNum = parseInt(t.cartao_id)
            const cartaoExiste = cartoes.find(c => c.id === cartaoIdNum)
            if (cartaoExiste) {
              cartaoId = cartaoIdNum
            }
          }
          
          // Validação: deve ter conta OU cartão (mas não ambos)
          if (!contaId && !cartaoId) {
            throw new Error('Deve ter uma conta OU um cartão')
          }
          
          if (contaId && cartaoId) {
            throw new Error('Não pode ter conta E cartão ao mesmo tempo')
          }
          
          validTransactions.push({
            descricao: t.descricao,
            valor: parseFloat(t.valor),
            tipo: t.tipo,
            data: t.data,
            categoria_id: categoriaExiste ? categoriaId : categorias[0]?.id || 1, // Fallback para primeira categoria
            conta_id: contaId,
            cartao_id: cartaoId,
            observacoes: t.observacoes || undefined
          })
          
        } catch (err) {
          validationErrors.push({
            linha: i + 1,
            erro: err.message,
            transacao: t
          })
        }
      }

      // Se há erros de validação, mostrar antes de processar
      if (validationErrors.length > 0) {
        setBulkResult({
          sucessos: 0,
          erros: validationErrors.length,
          detalhes: { sucessos: [], erros: validationErrors }
        })
        setIsProcessingBulk(false)
        return
      }

      if (validTransactions.length === 0) {
        alert('Preencha pelo menos uma transação válida')
        setIsProcessingBulk(false)
        return
      }
      console.log('Enviando transações:', validTransactions)
      console.log('Primeira transação detalhada:', JSON.stringify(validTransactions[0], null, 2))
      
      const results = []
      const errors = []
      
      // Processar uma por vez para capturar erros individuais
      for (let i = 0; i < validTransactions.length; i++) {
        try {
          const result = await transacoesApi.create(validTransactions[i])
          results.push(result)
        } catch (err) {
          console.error(`Erro na transação ${i + 1}:`, err)
          errors.push({
            linha: i + 1,
            erro: err.response?.data?.detail || 'Erro desconhecido',
            transacao: validTransactions[i]
          })
        }
      }
      
      setBulkResult({
        sucessos: results.length,
        erros: errors.length,
        detalhes: { sucessos: results, erros: errors }
      })
      
      // Reset form apenas se todas deram certo
      if (errors.length === 0) {
        setBulkTransactions([{
          data: new Date().toISOString().split('T')[0],
          descricao: '',
          valor: '',
          tipo: 'SAIDA' as 'ENTRADA' | 'SAIDA',
          categoria_id: '',
          conta_id: '',
          cartao_id: '',
          observacoes: ''
        }])
      }
      
      // 🚀 NOVO: Invalidar cache do dashboard após criação em lote
      if (results.length > 0) {
        invalidateAfterTransactionMutation();
      }
      
      queryClient.invalidateQueries('transacoes')
      queryClient.invalidateQueries('resumo-transacoes')
      
    } catch (error) {
      console.error('Erro geral:', error)
      setBulkResult({
        sucessos: 0,
        erros: 1,
        detalhes: { erros: [{ erro: 'Falha geral na criação das transações' }] }
      })
    } finally {
      setIsProcessingBulk(false)
    }
  }

  return (
    <div className="min-h-screen-mobile bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation user={user} />

      {/* 🎉 NOVO: Mensagens de Feedback */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="whitespace-pre-line text-sm">{successMessage}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="whitespace-pre-line text-sm">{errorMessage}</span>
          </div>
        </div>
      )}

      <div className="container-mobile pb-safe">
        {/* Page Header */}
        <div className="py-6 lg:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-responsive-heading text-slate-900 dark:text-white">Transações</h1>
                <p className="text-slate-600 dark:text-gray-300 text-sm sm:text-base">Gerencie todas as suas movimentações financeiras</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn-touch bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm border border-slate-200/50 dark:border-gray-600 space-x-2 touch-manipulation"
              >
                <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Filtros</span>
              </button>
              
              {/* NOVO: Botão de exportação Excel */}
              <button
                onClick={handleExportExcel}
                disabled={transacoes.length === 0}
                className="btn-touch bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-sm space-x-2 touch-manipulation"
              >
                <DocumentArrowDownIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Excel</span>
                <span className="sm:hidden">XLS</span>
              </button>
              
              <button
                onClick={() => setShowModal(true)}
                className="btn-touch bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl space-x-2 touch-manipulation"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Nova Transação</span>
              </button>
              
              <button
                onClick={() => setShowBulkModal(true)}
                className="btn-touch bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl space-x-2 touch-manipulation"
              >
                <CloudArrowUpIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Lançamento em Lote</span>
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        {showInfo && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 sm:p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg flex-shrink-0">
                  <Info className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-responsive-subheading text-slate-800 dark:text-white mb-3">
                    Como funciona o fluxo financeiro?
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <span className="font-medium text-slate-700 dark:text-gray-200 text-sm sm:text-base">Cartão de Crédito</span>
                      </div>
                      <ul className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 space-y-1 ml-6 sm:ml-7">
                        <li>• Compras não descontam imediatamente da conta</li>
                        <li>• Ficam como "futuro" até a data de vencimento</li>
                        <li>• Na fatura, é debitado da conta vinculada</li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span className="font-medium text-slate-700 dark:text-gray-200 text-sm sm:text-base">Conta Corrente</span>
                      </div>
                      <ul className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 space-y-1 ml-6 sm:ml-7">
                        <li>• Pagamentos à vista descontam imediatamente</li>
                        <li>• Saldo atualizado em tempo real</li>
                        <li>• Inclui recebimentos e pagamentos diretos</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 p-1 touch-manipulation flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Resumo */}
        {resumo && (
          <div className="grid-responsive mb-8">
            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400">Entradas</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(resumo.total_entradas)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-500 mt-1">
                    {resumo.total_entradas > 0 ? 'Receitas do período' : 'Nenhuma entrada'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400">Saídas</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(resumo.total_saidas)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-500 mt-1">
                    {resumo.total_saidas > 0 ? 'Gastos do período' : 'Nenhuma saída'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400">Saldo</p>
                  <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${resumo.saldo >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {formatCurrency(resumo.saldo)}
                  </p>
                  <p className={`text-xs sm:text-sm mt-1 ${
                    resumo.total_transacoes === 0 
                      ? 'text-slate-500 dark:text-gray-500' 
                      : resumo.saldo >= 0 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-orange-600 dark:text-orange-400'
                  }`}>
                    {resumo.total_transacoes === 0 
                      ? 'Sem movimentação' 
                      : resumo.saldo >= 0 
                        ? 'Saldo positivo' 
                        : 'Saldo negativo'
                    }
                  </p>
                </div>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  resumo.total_transacoes === 0 
                    ? 'bg-slate-50 dark:bg-gray-700' 
                    : resumo.saldo >= 0 
                      ? 'bg-blue-50 dark:bg-blue-900/30' 
                      : 'bg-orange-50 dark:bg-orange-900/30'
                }`}>
                  <DollarSign className={`w-5 h-5 sm:w-6 sm:h-6 ${
                    resumo.total_transacoes === 0 
                      ? 'text-slate-400 dark:text-gray-500' 
                      : resumo.saldo >= 0 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-orange-600 dark:text-orange-400'
                  }`} />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400">
                    Transações {getContextoTemporal()}
                  </p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">
                    {totalTransacoes}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-500 mt-1">
                    {totalTransacoes === 0 
                      ? 'Nenhuma transação' 
                      : totalTransacoes === 1 
                        ? '1 movimentação' 
                        : `${totalTransacoes} movimentações`
                    }
                    {transacoes.length < totalTransacoes && (
                      <span className="text-blue-600 dark:text-blue-400 ml-1">
                        • Mostrando {transacoes.length}
                      </span>
                    )}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 dark:text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        {showFilters && (
          <div className="card-mobile mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={filtros.busca || ''}
                    onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
                    placeholder="Descrição ou observação..."
                    className="pl-10 w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-slate-900 dark:text-white touch-manipulation text-sm sm:text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Tipo
                </label>
                <select
                  value={filtros.tipo || ''}
                  onChange={(e) => setFiltros(prev => ({ ...prev, tipo: e.target.value as 'ENTRADA' | 'SAIDA' || undefined }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-slate-900 dark:text-white touch-manipulation text-sm sm:text-base"
                >
                  <option value="">Todos</option>
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA">Saída</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Categoria
                </label>
                <select
                  value={filtros.categoria_id || ''}
                  onChange={(e) => setFiltros(prev => ({ ...prev, categoria_id: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-slate-900 dark:text-white touch-manipulation text-sm sm:text-base"
                >
                  <option value="">Todas</option>
                  {categorias.map(categoria => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.icone} {categoria.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Conta/Cartão
                </label>
                <select
                  value={filtros.conta_id || filtros.cartao_id ? `conta_${filtros.conta_id || ''}` || `cartao_${filtros.cartao_id || ''}` : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.startsWith('conta_')) {
                      const contaId = value.replace('conta_', '');
                      setFiltros(prev => ({ ...prev, conta_id: contaId ? parseInt(contaId) : undefined, cartao_id: undefined }));
                    } else if (value.startsWith('cartao_')) {
                      const cartaoId = value.replace('cartao_', '');
                      setFiltros(prev => ({ ...prev, cartao_id: cartaoId ? parseInt(cartaoId) : undefined, conta_id: undefined }));
                    } else {
                      setFiltros(prev => ({ ...prev, conta_id: undefined, cartao_id: undefined }));
                    }
                  }}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-slate-900 dark:text-white touch-manipulation text-sm sm:text-base"
                >
                  <option value="">Todos</option>
                  <optgroup label="Contas">
                    {contas.map(conta => (
                      <option key={`conta_${conta.id}`} value={`conta_${conta.id}`}>
                        {conta.nome} - {conta.banco}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Cartões">
                    {cartoes.map(cartao => (
                      <option key={`cartao_${cartao.id}`} value={`cartao_${cartao.id}`}>
                        {cartao.nome} - {cartao.bandeira}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Data Início
                </label>
                <input
                  type="date"
                  value={filtros.data_inicio || ''}
                  onChange={(e) => setFiltros(prev => ({ ...prev, data_inicio: e.target.value || undefined }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-slate-900 dark:text-white touch-manipulation text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={filtros.data_fim || ''}
                  onChange={(e) => setFiltros(prev => ({ ...prev, data_fim: e.target.value || undefined }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-slate-900 dark:text-white touch-manipulation text-sm sm:text-base"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-2 flex items-end gap-2">
                <button
                  onClick={() => setFiltros({
                    data_inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                    data_fim: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
                  })}
                  className="btn-touch border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  Mês Atual
                </button>
                <button
                  onClick={() => setFiltros({})}
                  className="btn-touch border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Todos os Períodos
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Transações */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Movimentações</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-slate-600 dark:text-gray-300">Carregando transações...</p>
            </div>
          ) : transacoes.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-gray-400">
              <Info className="w-12 h-12 mx-auto mb-4 text-slate-400 dark:text-gray-500" />
              <h3 className="text-lg font-medium mb-2">Nenhuma transação encontrada</h3>
              <p>Comece criando sua primeira movimentação financeira.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-gray-700">
              {transacoes.map((transacao) => (
                <div key={transacao.id} className="p-4 sm:p-6 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                  {/* Layout Mobile */}
                  <div className="block sm:hidden">
                    <div className="flex items-start space-x-3">
                      <div 
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                          transacao.tipo === 'ENTRADA' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      >
                        <span className="text-sm">
                          {transacao.categoria?.icone || (transacao.tipo === 'ENTRADA' ? '💰' : '💸')}
                        </span>
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {transacao.descricao}
                              </p>
                              {/* NOVO: Indicador de parcelamento */}
                              {transacao.is_parcelada && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                                  📅 {transacao.numero_parcela}/{transacao.total_parcelas}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span 
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  transacao.tipo === 'ENTRADA' 
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                }`}
                              >
                                {transacao.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-gray-400">
                                {transacao.categoria?.nome}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <p className={`text-lg font-semibold ${
                              transacao.tipo === 'ENTRADA' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {transacao.tipo === 'ENTRADA' ? '+' : '-'}{formatCurrency(transacao.valor)}
                            </p>
                            {/* NOVO: Indicador de parcela */}
                            {transacao.is_parcelada && (
                              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                Parcela {transacao.numero_parcela}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-gray-400">
                            {transacao.conta && (
                              <span>{transacao.conta.nome}</span>
                            )}
                            {transacao.cartao && (
                              <span>{transacao.cartao.nome}</span>
                            )}
                            <span>•</span>
                            <span>{formatDate(transacao.data)}</span>
                            {transacao.created_by_name && (
                              <>
                                <span>•</span>
                                <span title="Criado por">👤 {transacao.created_by_name}</span>
                              </>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            {/* Botões para transações simples */}
                            {!transacao.is_parcelada && (
                              <>
                                <button
                                  onClick={() => handleEdit(transacao)}
                                  className="p-2 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors touch-manipulation"
                                  title="Editar transação"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                
                                <button
                                  onClick={() => handleDelete(transacao.id)}
                                  className="p-2 text-slate-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors touch-manipulation"
                                  title="Excluir transação"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {/* NOVO: Botões para transações parceladas */}
                            {transacao.is_parcelada && (
                              <>
                                <button
                                  onClick={() => handleEditParcelamento(transacao)}
                                  className="p-2 text-slate-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors touch-manipulation"
                                  title="Ver detalhes do parcelamento"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                
                                <button
                                  onClick={() => handleEditParcelamento(transacao)}
                                  className="p-2 text-slate-400 dark:text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors touch-manipulation"
                                  title="Editar parcelamento"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                
                                <button
                                  onClick={() => handleDeleteParcelamento(transacao)}
                                  className="p-2 text-slate-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors touch-manipulation"
                                  title="Excluir parcelamento completo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {transacao.observacoes && (
                          <div className="mt-2">
                            <p className="text-sm text-slate-600 dark:text-gray-400 italic">
                              "{transacao.observacoes}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Layout Desktop */}
                  <div className="hidden sm:block">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div 
                          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                            transacao.tipo === 'ENTRADA' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        >
                          {transacao.categoria?.icone || (transacao.tipo === 'ENTRADA' ? '💰' : '💸')}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {transacao.descricao}
                            </p>
                            <span 
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                transacao.tipo === 'ENTRADA' 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                              }`}
                            >
                              {transacao.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
                            </span>
                            {/* NOVO: Indicador de parcelamento */}
                            {transacao.is_parcelada && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                                📅 Parcela {transacao.numero_parcela}/{transacao.total_parcelas}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-sm text-slate-500 dark:text-gray-400">
                              {transacao.categoria?.nome}
                            </p>
                            
                            {transacao.conta && (
                              <p className="text-sm text-slate-500 dark:text-gray-400">
                                {transacao.conta.nome}
                              </p>
                            )}
                            
                            {transacao.cartao && (
                              <p className="text-sm text-slate-500 dark:text-gray-400">
                                {transacao.cartao.nome}
                              </p>
                            )}
                            
                            <p className="text-sm text-slate-500 dark:text-gray-400">
                              {formatDate(transacao.data)}
                            </p>
                            
                            {transacao.created_by_name && (
                              <p className="text-sm text-slate-500 dark:text-gray-400" title="Criado por">
                                👤 {transacao.created_by_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className={`text-lg font-semibold ${
                            transacao.tipo === 'ENTRADA' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {transacao.tipo === 'ENTRADA' ? '+' : '-'}{formatCurrency(transacao.valor)}
                          </p>
                          {/* NOVO: Indicador de valor parcelado */}
                          {transacao.is_parcelada && (
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                              Parcela {transacao.numero_parcela} de {transacao.total_parcelas}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Botões para transações simples */}
                          {!transacao.is_parcelada && (
                            <>
                              <button
                                onClick={() => handleEdit(transacao)}
                                className="p-2 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors touch-manipulation"
                                title="Editar transação"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleDelete(transacao.id)}
                                className="p-2 text-slate-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors touch-manipulation"
                                title="Excluir transação"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* NOVO: Botões para transações parceladas */}
                          {transacao.is_parcelada && (
                            <>
                              <button
                                onClick={() => handleEditParcelamento(transacao)}
                                className="p-2 text-slate-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors touch-manipulation"
                                title="Ver detalhes do parcelamento"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleEditParcelamento(transacao)}
                                className="p-2 text-slate-400 dark:text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors touch-manipulation"
                                title="Editar parcelamento"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleDeleteParcelamento(transacao)}
                                className="p-2 text-slate-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors touch-manipulation"
                                title="Excluir parcelamento completo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {transacao.observacoes && (
                      <div className="mt-3 pl-14">
                        <p className="text-sm text-slate-600 dark:text-gray-400 italic">
                          "{transacao.observacoes}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <div className="p-6 text-center">
                  <button
                    onClick={loadMoreTransacoes}
                    disabled={loadingMore}
                    className="btn-touch bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {loadingMore ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Carregando...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Carregar Mais</span>
                        {transacoes.length < totalTransacoes && (
                          <span className="text-white/70 text-sm">
                            ({totalTransacoes - transacoes.length} restantes)
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>



        {/* Modal de Criação/Edição */}
        {showModal && (
          <div className="modal-mobile">
            <div className="modal-content-mobile">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <h2 className="text-responsive-subheading text-slate-900 dark:text-white">
                  {editingTransacao ? 'Editar Transação' : isParcelado ? 'Nova Compra Parcelada' : 'Nova Transação'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* NOVO: Toggle entre Transação e Parcelamento */}
                {!editingTransacao && (
                  <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 border border-slate-200 dark:border-gray-600">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
                      Tipo de Lançamento
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="tipoLancamento"
                          checked={!isParcelado}
                          onChange={() => setIsParcelado(false)}
                          className="w-4 h-4 text-blue-600 border-slate-300 dark:border-gray-500 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700"
                        />
                        <span className="ml-2 text-sm text-slate-700 dark:text-gray-200">Transação Simples</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="tipoLancamento"
                          checked={isParcelado}
                          onChange={() => setIsParcelado(true)}
                          className="w-4 h-4 text-blue-600 border-slate-300 dark:border-gray-500 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700"
                        />
                        <span className="ml-2 text-sm text-slate-700 dark:text-gray-200">Compra Parcelada</span>
                      </label>
                    </div>
                    {isParcelado && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        💳 Compras parceladas só podem ser feitas no cartão e geram transações automáticas a cada mês
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      Descrição *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder={isParcelado ? "Ex: iPhone 15 Pro" : "Ex: Compra no supermercado"}
                      className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      {isParcelado ? 'Valor Total *' : 'Valor *'}
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                      placeholder="0,00"
                      className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400"
                    />
                    {isParcelado && formData.valor && formParcelamento.total_parcelas > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        {formParcelamento.total_parcelas}x de R$ {(parseFloat(formData.valor) / formParcelamento.total_parcelas).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Campos específicos para parcelamento */}
                  {isParcelado && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                          Número de Parcelas *
                        </label>
                        <select
                          required
                          value={formParcelamento.total_parcelas}
                          onChange={(e) => setFormParcelamento({ ...formParcelamento, total_parcelas: parseInt(e.target.value) })}
                          className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
                        >
                          {Array.from({ length: 24 }, (_, i) => i + 2).map(num => (
                            <option key={num} value={num}>{num}x parcelas</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                          Data da Primeira Parcela *
                        </label>
                        <input
                          type="date"
                          required
                          value={formParcelamento.data_primeira_parcela}
                          onChange={(e) => setFormParcelamento({ ...formParcelamento, data_primeira_parcela: e.target.value })}
                          className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </>
                  )}

                  {!isParcelado && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Tipo *
                      </label>
                      <select
                        required
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'ENTRADA' | 'SAIDA' })}
                        className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
                      >
                        <option value="SAIDA">Saída</option>
                        <option value="ENTRADA">Entrada</option>
                      </select>
                    </div>
                  )}

                  {!isParcelado && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Data *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.data}
                        onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                        className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      Categoria *
                    </label>
                    <select
                      required
                      value={formData.categoria_id}
                      onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
                      className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
                    >
                      <option value="">Selecione uma categoria</option>
                      {categorias.map(categoria => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.icone} {categoria.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!isParcelado && (
                    <div className="space-y-4">


                      {/* Conta */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                          Conta
                        </label>
                        <select
                          value={formData.conta_id}
                          onChange={(e) => {
                            setFormData({ 
                              ...formData, 
                              conta_id: e.target.value,
                              cartao_id: '' // Clear cartão when conta is selected
                            });
                          }}
                          className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:ring-2 focus:border-transparent touch-manipulation text-sm sm:text-base transition-colors ${
                            formData.conta_id 
                              ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/30 focus:ring-green-500' 
                              : formData.cartao_id 
                                ? 'border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700 text-slate-400 dark:text-gray-500' 
                                : 'border-slate-300 dark:border-gray-600 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white'
                          }`}
                          disabled={!!formData.cartao_id}
                        >
                          <option value="">
                            {formData.cartao_id ? 'Desabilitado (cartão selecionado)' : 'Selecione uma conta'}
                          </option>
                          {contas.map(conta => (
                            <option key={conta.id} value={conta.id}>
                              {conta.nome} - {conta.banco}
                            </option>
                          ))}
                        </select>

                      </div>

                      {/* OU */}
                      <div className="text-center">
                        <span className="bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 px-3 py-1 rounded-full text-xs font-medium">
                          OU
                        </span>
                      </div>

                      {/* Cartão */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                          Cartão
                        </label>
                        <select
                          value={formData.cartao_id}
                          onChange={(e) => {
                            setFormData({ 
                              ...formData, 
                              cartao_id: e.target.value,
                              conta_id: '' // Clear conta when cartão is selected
                            });
                          }}
                          className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:ring-2 focus:border-transparent touch-manipulation text-sm sm:text-base transition-colors ${
                            formData.cartao_id 
                              ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/30 focus:ring-green-500' 
                              : formData.conta_id 
                                ? 'border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700 text-slate-400 dark:text-gray-500' 
                                : 'border-slate-300 dark:border-gray-600 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white'
                          }`}
                          disabled={!!formData.conta_id}
                        >
                          <option value="">
                            {formData.conta_id ? 'Desabilitado (conta selecionada)' : 'Selecione um cartão'}
                          </option>
                          {cartoes.map(cartao => (
                            <option key={cartao.id} value={cartao.id}>
                              {cartao.nome} - {cartao.bandeira}
                            </option>
                          ))}
                        </select>

                      </div>
                    </div>
                  )}

                  {isParcelado && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Cartão *
                      </label>
                      <select
                        required
                        value={formData.cartao_id}
                        onChange={(e) => {
                          setFormData({ 
                            ...formData, 
                            cartao_id: e.target.value
                          });
                        }}
                        className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                      >
                        <option value="">Selecione um cartão</option>
                        {cartoes.map(cartao => (
                          <option key={cartao.id} value={cartao.id}>
                            {cartao.nome} - {cartao.bandeira}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        Compras parceladas são sempre no cartão de crédito
                      </p>
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Informações adicionais sobre a transação..."
                    rows={2}
                    className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base resize-none bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400"
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingTransacao(null);
                      resetForm();
                    }}
                    className="btn-touch border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors order-2 sm:order-1"
                  >
                    Cancelar
                  </button>
                  
                  <button
                    type="submit"
                    className="btn-touch bg-gradient-to-r from-blue-600 to-purple-600 border border-transparent text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 order-1 sm:order-2"
                  >
                    {editingTransacao ? 'Atualizar' : isParcelado ? 'Criar Parcelamento' : 'Criar'} 
                    {editingTransacao ? ' Transação' : ''}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Lançamento em Lote */}
        {showBulkModal && (
          <div className="modal-mobile">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-7xl w-full max-h-[90vh] mx-4 my-8 overflow-hidden flex flex-col shadow-2xl">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">📊 Lançamento em Lote</h2>
                  <button
                    onClick={() => {
                      setShowBulkModal(false)
                      setBulkResult(null)
                    }}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto">
                {/* Campo de IA para análise automática */}
                <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                  <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-200 mb-3 flex items-center gap-2">
                    🤖 Análise Automática com IA
                  </h3>
                  <p className="text-purple-700 dark:text-purple-300 text-sm mb-4">
                    Cole dados do seu extrato bancário ou digite transações. A IA vai analisar e preencher a tabela automaticamente.
                  </p>
                  
                  <div className="space-y-3">
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Cole aqui dados do extrato bancário:&#10;06/06/2025 UBER* TRIP R$ 9,92 Transporte Bradesco Saída&#10;05/06/2025 UBER* TRIP R$ 48,90 Transporte Bradesco Saída&#10;..."
                      rows={6}
                      className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400 text-sm font-mono resize-none"
                    />
                    
                    <div className="flex gap-3">
                      <button
                        onClick={processWithAI}
                        disabled={isProcessingAI || !rawText.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {isProcessingAI ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            Processando...
                          </>
                        ) : (
                          <>
                            🧠 Analisar com IA
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => setRawText('')}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabela de Transações */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white w-32">Data</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white w-48">Descrição *</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white w-24">Valor *</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white w-24">Tipo</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white w-40">Categoria *</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white w-32">Conta</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white w-32">Cartão</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white w-48">Observações</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-900 dark:text-white w-16">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkTransactions.map((transaction, index) => (
                        <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={transaction.data}
                              onChange={(e) => updateBulkRow(index, 'data', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={transaction.descricao}
                              onChange={(e) => updateBulkRow(index, 'descricao', e.target.value)}
                              placeholder="Descrição da transação"
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={transaction.valor}
                              onChange={(e) => updateBulkRow(index, 'valor', e.target.value)}
                              placeholder="0,00"
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={transaction.tipo}
                              onChange={(e) => updateBulkRow(index, 'tipo', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
                            >
                              <option value="SAIDA">Saída</option>
                              <option value="ENTRADA">Entrada</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={transaction.categoria_id}
                              onChange={(e) => updateBulkRow(index, 'categoria_id', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
                            >
                              <option value="">Selecione...</option>
                              {categorias.map(categoria => (
                                <option key={categoria.id} value={categoria.id}>
                                  {categoria.icone} {categoria.nome}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={transaction.conta_id}
                              onChange={(e) => updateBulkRow(index, 'conta_id', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
                            >
                              <option value="">Selecione...</option>
                              {contas.map(conta => (
                                <option key={conta.id} value={conta.id}>
                                  {conta.nome} - {conta.banco}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={transaction.cartao_id}
                              onChange={(e) => updateBulkRow(index, 'cartao_id', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
                            >
                              <option value="">Selecione...</option>
                              {cartoes.map(cartao => (
                                <option key={cartao.id} value={cartao.id}>
                                  {cartao.nome} - {cartao.bandeira}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={transaction.observacoes}
                              onChange={(e) => updateBulkRow(index, 'observacoes', e.target.value)}
                              placeholder="Observações..."
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeBulkRow(index)}
                              className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
                              disabled={bulkTransactions.length === 1}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Botões de Ação */}
                <div className="flex justify-between items-center mt-6">
                  <button
                    onClick={addBulkRow}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Linha
                  </button>

                  <button
                    onClick={processBulkTransactions}
                    disabled={isProcessingBulk}
                    className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isProcessingBulk ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        Processar Lote ({bulkTransactions.filter(t => t.descricao && t.valor && t.categoria_id).length} válidas)
                      </>
                    )}
                  </button>
                </div>

                {/* Resultado do Processamento */}
                {bulkResult && (
                  <div className={`mt-6 rounded-xl p-4 ${bulkResult.erros > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                    <h3 className={`text-lg font-semibold mb-3 ${bulkResult.erros > 0 ? 'text-red-900 dark:text-red-200' : 'text-green-900 dark:text-green-200'}`}>
                      {bulkResult.erros > 0 ? '⚠️ Processamento com Erros' : '✅ Processamento Concluído'}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                        <span className="text-gray-600 dark:text-gray-300">Sucessos:</span>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">{bulkResult.sucessos}</div>
                      </div>
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                        <span className="text-gray-600 dark:text-gray-300">Erros:</span>
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">{bulkResult.erros}</div>
                      </div>
                    </div>

                    {/* Detalhes dos Erros */}
                    {bulkResult.detalhes?.erros?.length > 0 && (
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                        <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Erros Encontrados:</h4>
                        <div className="max-h-32 overflow-y-auto space-y-2">
                          {bulkResult.detalhes.erros.map((erro: any, index: number) => (
                            <div key={index} className="text-xs bg-red-50 dark:bg-red-900/30 p-2 rounded border-l-2 border-red-300 dark:border-red-600">
                              <div className="font-medium text-red-700 dark:text-red-300">Linha {erro.linha}:</div>
                              <div className="text-red-600 dark:text-red-400">{erro.erro}</div>
                              {erro.transacao && (
                                <div className="text-gray-500 dark:text-gray-400 mt-1">
                                  {erro.transacao.descricao} - R$ {erro.transacao.valor}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Dicas de Uso */}
                <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">💡 Dicas de Uso</h3>
                  <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
                    <li>• <strong>IA Automática:</strong> Cole dados do extrato bancário no campo roxo e use "Analisar com IA"</li>
                    <li>• <strong>Copy & Paste:</strong> Você também pode copiar dados do Excel e colar diretamente nas células</li>
                    <li>• <strong>Campos obrigatórios:</strong> Descrição, Valor e Categoria são obrigatórios</li>
                    <li>• <strong>Conta vs Cartão:</strong> Use apenas um dos dois por transação</li>
                    <li>• <strong>Validação:</strong> Transações inválidas não serão processadas</li>
                    <li>• <strong>Revisão:</strong> Sempre revise os dados preenchidos pela IA antes de processar</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transacoes; 