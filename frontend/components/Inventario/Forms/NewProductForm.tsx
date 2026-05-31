import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {Plus} from "lucide-react"

import { Input } from "@/components/ui/input"

export function NewProductForm() {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="name">Nombre</FieldLabel>
        <Input id="name" placeholder="Leche" />
      </Field>

      <Field>
        <FieldLabel htmlFor="categoria">Categoria</FieldLabel>

        <div className="flex items-center gap-3">
          <Select defaultValue="Otros">
            <SelectTrigger className="flex-1" id="categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Electronica">Electronica</SelectItem>
              <SelectItem value="Ropa">Ropa</SelectItem>
              <SelectItem value="Otros">Otros</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/NuevaCategoria">
            <Button variant="outline" size="icon" className="rounded-full">
              <Plus />
            </Button>
          </Link>
        </div>

      </Field>

      
      <Field>
        
        <FieldLabel htmlFor="precio">Precio</FieldLabel>
        <Input id="precio" placeholder="0" />
      </Field>
      <Field>
        <FieldLabel htmlFor="stock">Stock</FieldLabel>
        <Input id="stock" placeholder="0" />
      </Field>

      <Field orientation="horizontal">
        <Button type="reset" variant="outline">
          Resetear
        </Button>
        <Button type="submit">Crear</Button>
      </Field>
    </FieldGroup>
  )
}

export default NewProductForm
