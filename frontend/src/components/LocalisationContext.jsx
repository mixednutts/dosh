import { createContext, useContext, useMemo } from 'react'
import PropTypes from 'prop-types'
import { DEFAULT_LOCALISATION, makeLocalisation } from '../utils/localisation'

const LocalisationContext = createContext(makeLocalisation(DEFAULT_LOCALISATION))

export function LocalisationProvider({ budget, children }) {
  const value = useMemo(() => makeLocalisation(budget || DEFAULT_LOCALISATION), [budget])
  return (
    <LocalisationContext.Provider value={value}>
      {children}
    </LocalisationContext.Provider>
  )
}

LocalisationProvider.propTypes = {
  budget: PropTypes.shape({
    locale: PropTypes.string,
    currency: PropTypes.string,
    timezone: PropTypes.string,
    date_format: PropTypes.string,
  }),
  children: PropTypes.node.isRequired,
}

export function useLocalisation() {
  return useContext(LocalisationContext)
}
