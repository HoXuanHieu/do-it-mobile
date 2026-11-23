import { useState } from 'react'
import { View } from 'react-native'
import { t, tx } from '../../i18n'
import { applyServerErrors } from '../../lib/forms'
import { Button, Card, ConfirmDialog, ErrorText, Field, H2, Input, LinkText, Muted, Notice, Row, RowBetween, Sheet, SheetActions, SwitchRow, Txt } from '../../ui/components'
import { useColors } from '../../ui/theme'
import type { CategoryDto, TransactionType } from './api'
import { CatBadge, ColorSwatchPicker } from './components'
import { useCategories, useDeleteCategory, useRestoreCategory, useSaveCategory } from './queries'

type Editing = { kind: 'create'; type: TransactionType } | { kind: 'edit'; category: CategoryDto }

/** FR-FI-007 + Supplement SUP-FI-06 (archive instead of delete when used). */
export function CategoriesTab() {
  const col = useColors()
  const [showArchived, setShowArchived] = useState(false)
  const { data = [], isPending, isError } = useCategories(true)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<CategoryDto | null>(null)
  const [notice, setNotice] = useState('')
  const remove = useDeleteCategory()
  const restore = useRestoreCategory()

  const visible = data.filter((c) => showArchived || !c.isArchived)

  return (
    <>
      <SwitchRow label={t('Hiện danh mục đã lưu trữ')} value={showArchived} onChange={setShowArchived} />
      {notice ? <Notice>{notice}</Notice> : null}
      {isPending && <Muted>{t('Đang tải…')}</Muted>}
      {isError && <ErrorText>{t('Không tải được danh mục.')}</ErrorText>}

      {(['Expense', 'Income'] as const).map((type) => (
        <Card key={type}>
          <RowBetween>
            <H2>{type === 'Expense' ? t('Danh mục chi') : t('Danh mục thu')}</H2>
            <Button small variant="ghost" title={t('+ Thêm')} onPress={() => setEditing({ kind: 'create', type })} />
          </RowBetween>
          {visible.filter((c) => c.type === type).map((c) => (
            <Row key={c.id} style={{ opacity: c.isArchived ? 0.6 : 1 }}>
              <CatBadge name={tx(c.name)} color={c.color} />
              <Txt style={{ flex: 1 }}>
                {tx(c.name)}
                {c.isDefault && <Muted style={{ fontSize: 12 }}> · {t('mặc định')}</Muted>}
                {c.isArchived && <Muted style={{ fontSize: 12 }}> · {t('đã lưu trữ')}</Muted>}
              </Txt>
              {c.isArchived ? (
                <LinkText onPress={restore.isPending ? undefined : () => restore.mutate(c.id)}>{t('Khôi phục')}</LinkText>
              ) : (
                <>
                  <LinkText onPress={() => setEditing({ kind: 'edit', category: c })}>{t('Sửa')}</LinkText>
                  {!c.isDefault && <LinkText style={{ color: col.danger }} onPress={() => setDeleting(c)}>{t('Xóa')}</LinkText>}
                </>
              )}
            </Row>
          ))}
        </Card>
      ))}

      <Sheet open={!!editing} title={editing?.kind === 'edit' ? t('Sửa danh mục') : t('Thêm danh mục')} onClose={() => setEditing(null)}>
        {editing && <CategoryForm key={editing.kind === 'edit' ? editing.category.id : editing.type} editing={editing} onDone={() => setEditing(null)} />}
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        title={t('Xóa danh mục?')}
        message={t('Nếu “{name}” đã có giao dịch hoặc ngân sách, danh mục sẽ được lưu trữ để giữ lịch sử (có thể khôi phục).', { name: tx(deleting?.name ?? '') })}
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          remove.mutate(deleting!.id, {
            onSuccess: (r) => {
              setNotice(r.result === 'archived' ? t('Đã lưu trữ “{name}”.', { name: tx(deleting!.name) }) : t('Đã xóa “{name}”.', { name: tx(deleting!.name) }))
              setDeleting(null)
            },
          })
        }
      />
    </>
  )
}

function CategoryForm({ editing, onDone }: { editing: Editing; onDone: () => void }) {
  const save = useSaveCategory()
  const [name, setName] = useState(editing.kind === 'edit' ? editing.category.name : '')
  const [color, setColor] = useState(editing.kind === 'edit' ? editing.category.color : '#1971c2')
  const [error, setError] = useState('')
  const type = editing.kind === 'edit' ? editing.category.type : editing.type

  async function submit() {
    if (!name.trim()) return setError(t('Vui lòng nhập tên danh mục'))
    setError('')
    try {
      await save.mutateAsync({ id: editing.kind === 'edit' ? editing.category.id : undefined, name: name.trim(), color, type })
      onDone()
    } catch (err) {
      setError(applyServerErrors(err))
    }
  }

  return (
    <>
      <Muted>{type === 'Expense' ? t('Danh mục chi') : t('Danh mục thu')}</Muted>
      <Field label={t('Tên danh mục')} error={error}>
        <Input autoFocus maxLength={50} value={name} onChangeText={setName} invalid={!!error} onSubmitEditing={submit} />
      </Field>
      <View style={{ gap: 4 }}>
        <Txt style={{ fontSize: 14, fontWeight: '500' }}>{t('Màu')}</Txt>
        <ColorSwatchPicker value={color} onChange={setColor} />
      </View>
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onDone} />
        <Button title={save.isPending ? t('Đang lưu…') : t('Lưu')} busy={save.isPending} onPress={submit} />
      </SheetActions>
    </>
  )
}
