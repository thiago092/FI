import { useCallback } from 'react';
import * as XLSX from 'xlsx';

interface ExportOptions {
  filename?: string;
  sheetName?: string;
}

export const useExcelExport = () => {
  
  // Exportar array de objetos para Excel
  const exportToExcel = useCallback((data: any[], options: ExportOptions = {}) => {
    try {
      const {
        filename = `exportacao_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName = 'Dados'
      } = options;

      // Criar workbook
      const wb = XLSX.utils.book_new();
      
      // Converter dados para worksheet
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      // Fazer download
      XLSX.writeFile(wb, filename);
      
      return true;
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      return false;
    }
  }, []);

  // Exportar transações com formatação específica
  const exportTransacoes = useCallback((transacoes: any[], filtros: any = {}) => {
    const dadosFormatados = transacoes.map(transacao => ({
      'Data': new Date(transacao.data).toLocaleDateString('pt-BR'),
      'Descrição': transacao.descricao,
      'Valor': transacao.valor,
      'Tipo': transacao.tipo === 'ENTRADA' ? 'Entrada' : 'Saída',
      'Categoria': transacao.categoria?.nome || 'Sem categoria',
      'Conta': transacao.conta?.nome || 'N/A',
      'Cartão': transacao.cartao?.nome || 'N/A',
      'Observações': transacao.observacoes || '',
      'Parcela': transacao.is_parcelada ? `${transacao.numero_parcela}/${transacao.total_parcelas}` : 'Não',
      'Criado em': new Date(transacao.created_at).toLocaleString('pt-BR')
    }));

    // Criar nome do arquivo baseado nos filtros
    let nomeArquivo = 'transacoes';
    
    if (filtros.data_inicio && filtros.data_fim) {
      const inicio = new Date(filtros.data_inicio).toLocaleDateString('pt-BR').replace(/\//g, '-');
      const fim = new Date(filtros.data_fim).toLocaleDateString('pt-BR').replace(/\//g, '-');
      nomeArquivo += `_${inicio}_a_${fim}`;
    }
    
    if (filtros.tipo) {
      nomeArquivo += `_${filtros.tipo.toLowerCase()}`;
    }
    
    nomeArquivo += `_${new Date().toISOString().split('T')[0]}.xlsx`;

    return exportToExcel(dadosFormatados, {
      filename: nomeArquivo,
      sheetName: 'Transações'
    });
  }, [exportToExcel]);

  // Exportar categorias
  const exportCategorias = useCallback((categorias: any[]) => {
    const dadosFormatados = categorias.map(categoria => ({
      'ID': categoria.id,
      'Nome': categoria.nome,
      'Cor': categoria.cor,
      'Ícone': categoria.icone,
      'Total Transações': categoria.total_transacoes || 0,
      'Valor Total': categoria.valor_total || 0
    }));

    return exportToExcel(dadosFormatados, {
      filename: `categorias_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: 'Categorias'
    });
  }, [exportToExcel]);

  // Exportar cartões
  const exportCartoes = useCallback((cartoes: any[]) => {
    const dadosFormatados = cartoes.map(cartao => ({
      'ID': cartao.id,
      'Nome': cartao.nome,
      'Bandeira': cartao.bandeira,
      'Limite': cartao.limite || 0,
      'Usado': cartao.usado || 0,
      'Disponível': cartao.disponivel || 0,
      'Vencimento': cartao.dia_vencimento || 'N/A',
      'Fechamento': cartao.dia_fechamento || 'N/A'
    }));

    return exportToExcel(dadosFormatados, {
      filename: `cartoes_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: 'Cartões'
    });
  }, [exportToExcel]);

  return {
    exportToExcel,
    exportTransacoes,
    exportCategorias,
    exportCartoes
  };
}; 