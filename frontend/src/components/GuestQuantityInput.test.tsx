import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import GuestQuantityInput from './GuestQuantityInput'

function Harness({ initial = '', onChangeSpy }: { initial?: string; onChangeSpy?: (v: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <GuestQuantityInput
      label="Guests"
      value={value}
      onChange={(v) => {
        setValue(v)
        onChangeSpy?.(v)
      }}
    />
  )
}

describe('GuestQuantityInput', () => {
  it('allows clear and positive integer input only', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<Harness onChangeSpy={onChange} />)
    const input = screen.getByPlaceholderText('Enter guests')

    await user.type(input, '12abc')
    expect(onChange).toHaveBeenLastCalledWith('12')
  })

  it('supports increment and decrement buttons', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<Harness initial="3" onChangeSpy={onChange} />)
    const plus = screen.getByRole('button', { name: /Increase guests/i })
    const minus = screen.getByRole('button', { name: /Decrease guests/i })

    await user.click(plus)
    expect(onChange).toHaveBeenLastCalledWith('4')

    await user.click(minus)
    expect(onChange).toHaveBeenLastCalledWith('3')
  })

  it('handles arrow key navigation', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<Harness initial="5" onChangeSpy={onChange} />)
    const input = screen.getByDisplayValue('5')

    await user.click(input)
    await user.keyboard('{ArrowUp}')
    expect(onChange).toHaveBeenLastCalledWith('6')

    await user.keyboard('{ArrowDown}')
    expect(onChange).toHaveBeenLastCalledWith('5')
  })
})
