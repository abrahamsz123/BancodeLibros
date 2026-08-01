import React from 'react';
import { CATEGORIAS } from './BookForm';

// Definición de grados escolares venezolanos
export const GRADOS = [
  '1er Grado',
  '2do Grado',
  '3er Grado',
  '4to Grado',
  '5to Grado',
  '6to Grado',
  '1er Año',
  '2do Año',
  '3er Año',
  '4to Año',
  '5to Año'
];

/**
 * Componente que agrupa la barra de búsqueda, los filtros de categoría, grado, trato y ordenación.
 * 
 * @param {Object} props
 * @param {Object} props.filters - Estado de filtros actuales
 * @param {Function} props.onFilterChange - Callback para actualizar un filtro
 */
export default function Filters({ filters, onFilterChange }) {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFilterChange(name, value);
  };

  const handleDealTypeChange = (type) => {
    onFilterChange('tipoTrato', type);
  };

  return (
    <div className="filters-panel">
      {/* Fila superior: Barra de búsqueda */}
      <div className="search-row">
        <div className="search-input-wrapper">
          <svg
            className="search-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleInputChange}
            placeholder="Buscar por título o autor..."
            aria-label="Buscar libros"
          />
        </div>
      </div>

      {/* Fila inferior: Filtros y Ordenamiento */}
      <div className="filter-controls">
        {/* Filtro por Categoría/Materia */}
        <div className="control-group">
          <label htmlFor="filter-categoria">Materia / Categoría</label>
          <select
            id="filter-categoria"
            name="categoria"
            value={filters.categoria}
            onChange={handleInputChange}
            className="select-custom"
          >
            <option value="Todas">Todas las materias</option>
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Año Escolar */}
        <div className="control-group">
          <label htmlFor="filter-grado">Grado / Año Escolar</label>
          <select
            id="filter-grado"
            name="grado"
            value={filters.grado}
            onChange={handleInputChange}
            className="select-custom"
          >
            <option value="Todos">Todos los grados</option>
            {GRADOS.map((gr) => (
              <option key={gr} value={gr}>
                {gr}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Tipo de Trato */}
        <div className="control-group">
          <label>Tipo de Trato</label>
          <div className="deal-type-filters">
            {['Todos', 'Venta', 'Regalo', 'Intercambio'].map((type) => (
              <button
                key={type}
                type="button"
                className={`deal-filter-btn ${filters.tipoTrato === type ? 'active' : ''}`}
                onClick={() => handleDealTypeChange(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Ordenamiento */}
        <div className="control-group">
          <label htmlFor="filter-sort">Ordenar por</label>
          <select
            id="filter-sort"
            name="sortBy"
            value={filters.sortBy}
            onChange={handleInputChange}
            className="select-custom"
          >
            <option value="recientes">Más recientes primero</option>
            <option value="alfabetico">Orden alfabético (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
