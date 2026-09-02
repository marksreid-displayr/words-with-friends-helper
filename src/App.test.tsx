import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('offers a private screenshot flow and manual fallback', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: /turn a screenshot/i })).toBeInTheDocument()
    expect(screen.getByText(/stays on your device/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /enter a board manually/i }))
    expect(screen.getByRole('heading', { name: /check the board/i })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell')).toHaveLength(225)
    expect(screen.getByText(/confirm your tiles/i)).toBeInTheDocument()
  })
})
