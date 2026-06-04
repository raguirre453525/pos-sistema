
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function ImageForm() {
  return (
    <Field>
      <FieldLabel htmlFor="picture">Imagen</FieldLabel>
      <Input id="picture" type="file" />
      <FieldDescription>Selecciona una Imagen...</FieldDescription>
    </Field>
  )
}

export default ImageForm
