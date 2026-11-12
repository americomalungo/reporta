/** Campos aceites ao criar uma categoria de incidentes. */
export interface CreateCategoryData {
  /** Nome apresentado da categoria. */
  name: string;
  /** Descrição opcional. */
  description?: string;
  /** Identificador visual opcional. */
  icon?: string;
  /** Cor RGB opcional. */
  color?: string;
  /** Indica se a categoria gera alertas de risco. */
  isRisk: boolean;
  /** Slug único derivado do nome. */
  slug: string;
}

/** Campos editáveis de uma categoria existente. */
export interface UpdateCategoryData {
  /** Novo nome apresentado. */
  name?: string;
  /** Nova descrição ou null para a remover. */
  description?: string | null;
  /** Novo ícone ou null para o remover. */
  icon?: string | null;
  /** Nova cor ou null para a remover. */
  color?: string | null;
  /** Novo estado de risco. */
  isRisk?: boolean;
  /** Novo estado de ativação. */
  isActive?: boolean;
  /** Novo slug único. */
  slug?: string;
}
