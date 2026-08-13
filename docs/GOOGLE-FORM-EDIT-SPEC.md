# Google Form edit spec — "Formulario de Membresía"

Instructions for an agent editing the RELIF membership form in the Google Forms
web editor. Everything needed is in this file; no other context is required.

**Form:** `Formulario de Membresía`
**URL:** https://docs.google.com/forms/d/1c-ut0YLFhZ-CEXB4_rT_C9j69szUTuyixWLbZF_dia8/edit
**Current state:** 19 questions, 3 sections, 58 responses already collected.

---

## Why the exact wording matters

Responses from this form are read by an importer that resolves each answer
against a fixed vocabulary and publishes a public directory profile
automatically. It matches on the **question title** and on the **exact option
label**. A reworded title silently stops feeding its field; a mistyped option
label makes the answer unresolvable and blocks publication.

So: **copy every title and every option label character for character**,
including accents (á é í ó ú ñ), capitalisation, and punctuation. Do not
"improve" wording, do not add help text inside a title, do not translate.

Where a title ends with a colon in this spec, include the colon.

---

## Hard rules

1. **Do not delete any existing question.** 58 people have already answered them.
2. **Do not reorder or rename** any question not named in Part A.
3. **Do not change the form title, description, theme, or logo.**
4. **Do not touch Settings**, in particular "Collect email addresses" — leave it on.
5. Changing a question's *type* is expected in Part A. Google will warn that
   existing answers may be affected. Accept the warning and continue.
6. Option labels go in the **options**. Explanatory text goes in the question's
   **description** (⋮ menu → "Description"). Never merge the two.

---

## PART A — edit three existing questions

### A1. Rename the name question

**Find:** `Nombre y apellidos completos:` (in the representatives section)

Rename it to exactly:

```
Nombre completo
```

Keep type **Short answer**, keep **Required** on. Set its description to:

```
Su nombre completo, tal como desea que aparezca en el directorio.
```

> One field, not two. The directory stores the name exactly as it is typed
> precisely because it cannot be split reliably — given "María Fernanda Gómez
> Ruiz" nothing can tell whether the surname begins at "Gómez" or at "Fernanda",
> so no split is attempted at all.

### A2. Turn the organisation question into a picklist

**Find:** `Nombre de la organización:` (in the Organización section)

Rename it to exactly:

```
Organización:
```

Change its type to **Dropdown**. Required: **no** — a member with no listed
organisation leaves it blank and is published as an independent member.

Add a description:

```
Si su organización no aparece en la lista, deje esta pregunta en blanco.
```

Options — all 37, exactly as written:

```
ITESO, Universidad Jesuita de Guadalajara
Pontificia Universidad Javeriana
Pontificia Universidad Javeriana Cali
Universidad Católica de Córdoba
Universidad Centroamericana “José Simeón Cañas”
Universidad Centroamericana
Santa Clara University · Miller Center
Universidad del Pacífico
Universidad ESAN
Universidad Iberoamericana Ciudad de México
Universidad Iberoamericana León
Universidad Iberoamericana Puebla
Universidad Iberoamericana Torreón
Universidad Iberoamericana Tijuana
Universidad Autónoma de Sinaloa
Universidad Intercontinental
Universidad del Bío-Bío
Universidad de Santiago de Chile
Instituto Profesional Duoc UC
Universidade Federal de Minas Gerais
Universidad Antonio Ruiz de Montoya
Universidad Autónoma de Occidente
Universidad Nacional Abierta y a Distancia (UNAD)
Universidad de San Buenaventura
Universidad Pontificia de Comillas
University of Technology of Troyes
Aalto University
Up Innovation Consulting
Frugal Lab
Innodeva
Fundación Acción Cultural Popular (ACPO)
Cámara Verde de Comercio
REBRIF · Rede Brasileira de Inovação Frugal
World Entrepreneurs
Ecoins
Captanda
CTIC-UNI
```

> Note the curly quotes in “José Simeón Cañas” and the middle dots (·) in
> "Santa Clara University · Miller Center" and "REBRIF · Rede Brasileira de
> Inovação Frugal". These must be copied exactly, not replaced with straight
> quotes or hyphens.

### A3. Turn the position question into a picklist

**Find:** `Cargo dentro la organización:` (note: the existing title is missing a
"de" — leave that as it is, do not correct it)

Change its type to **Multiple choice**. Keep **Required** on.

Options — exactly these five and nothing else:

```
Personal administrativo
Docente
Investigador/a
Directivo/a
Miembro independiente
```

> Free text does not work here. "Investigadora" does not resolve;
> "Investigador/a" does.

---

## PART B — move and convert the two location questions

These two currently sit in the **Organización** section, which is marked optional
for individual affiliates. They must become required and apply to the person, so
move them into the **representatives** section, directly below `Nombre completo`.

### B1. País

**Find:** `País donde se encuentra la organización:`

Move it below `Nombre completo`. Rename to exactly:

```
País:
```

Change type to **Dropdown**. Required: **yes**. Options — all 21:

```
Argentina
Bolivia
Brasil
Chile
Colombia
Costa Rica
Ecuador
El Salvador
España
Estados Unidos
Finlandia
Francia
Guatemala
México
Nicaragua
Panamá
Paraguay
Perú
Suiza
Uruguay
Venezuela
```

### B2. Región

**Find:** `Ciudad donde se encuentra la organización:`

Move it directly below `País:`. Rename to exactly:

```
Región / Estado:
```

Change type to **Dropdown**. Required: **yes**. Add a description:

```
Seleccione la región, estado o departamento correspondiente a su país.
```

Options — all 84, in this order:

```
Buenos Aires
Córdoba
Mendoza
Santa Fe
Tucumán
La Paz
Cochabamba
Santa Cruz
Tarija
São Paulo
Minas Gerais
Rio de Janeiro
Bahia
Paraná
Pernambuco
Región Metropolitana
Valparaíso
Biobío
Antofagasta
Los Lagos
Bogotá D.C.
Antioquia
Valle del Cauca
Atlántico
Santander
San José
Alajuela
Cartago
Heredia
Guanacaste
Pichincha
Guayas
Azuay
Manabí
San Salvador
Santa Ana
San Miguel
La Libertad
Madrid
Cataluña
Andalucía
País Vasco
California
Texas
Nueva York
Florida
Uusimaa
Pirkanmaa
Grand Est
Isla de Francia
Occitania
Guatemala
Quetzaltenango
Sacatepéquez
Ciudad de México
Jalisco
Puebla
Guanajuato
Coahuila
Sinaloa
Baja California
Managua
León
Granada
Panamá
Colón
Chiriquí
Asunción
Central
Alto Paraná
Lima
Arequipa
Cusco
Piura
Ginebra
Zúrich
Vaud
Montevideo
Canelones
Maldonado
Distrito Capital
Zulia
Miranda
Carabobo
```

> `La Libertad` belongs to both El Salvador and Perú. It appears **once** in this
> list on purpose — do not add it twice. The importer checks the region against
> the country that was chosen, so one entry serves both.

---

## PART C — add six new questions

Add all six in the **representatives** section, in this order, immediately after
the existing `Perfil de LinkedIn (opcional):` question.

### C1. Puesto

- Title: `Puesto:`
- Type: **Short answer**
- Required: **no**
- Description: `Su cargo específico, tal como desea que aparezca en el directorio. Por ejemplo: Jefa de Vinculación Comunitaria.`

### C2. Biografía

- Title: `Biografía`
- Type: **Paragraph**
- Required: **no**
- Description: `Breve descripción de su trabajo (máximo 800 caracteres).`

### C3. Intereses

- Title: `Intereses`
- Type: **Checkboxes**
- Required: **yes**
- Description: `Seleccione todos los que apliquen.`

Options — all 12:

```
Metodologías frugales
Educación y formación
Economía circular
Emprendimiento social
Tecnologías digitales
Salud frugal
Energía asequible
Agua y saneamiento
Agricultura sostenible
Políticas públicas
Diseño centrado en comunidades
Manufactura local
```

### C4. Áreas generales

- Title: `Áreas generales`
- Type: **Checkboxes**
- Required: **yes**
- Description: `Seleccione hasta 3 áreas amplias.`

Options — all 10:

```
Ingeniería
Negocios y administración
Ciencias sociales
Salud pública
Diseño y artes
Ciencias naturales
Educación
Computación y datos
Derecho y políticas
Agronomía
```

### C5. Idiomas

- Title: `Idiomas`
- Type: **Checkboxes**
- Required: **yes**
- Description: `Seleccione todos los que apliquen.`

Options — all 6:

```
Español
Portugués
Inglés
Francés
Italiano
Alemán
```

### C6. Consentimiento — add this one LAST, at the very end of the form

- Title: `Consentimiento`
- Type: **Checkboxes**
- Required: **yes**
- Description:

```
Su perfil se publicará en el directorio público de la Red Latinoamericana de
Innovación Frugal. Se publicarán su nombre, organización, país, región, puesto,
biografía, intereses, áreas e idiomas. Su correo electrónico NUNCA se publica.
Puede solicitar la eliminación de su perfil en cualquier momento escribiendo a
redinnovacionfrugal@gmail.com.
```

Options — exactly one option, exactly this text:

```
Acepto
```

> Only `Acepto` works. Not "Sí, acepto", not "Acepto ✓", not "De acuerdo".
> The long explanation goes in the **description** field, never in the option
> label — the label is what gets exported as the answer.

---

## PART D — do not touch

Leave these exactly as they are. They collect application context, not profile
data, and the importer correctly ignores them:

- `Email` (the built-in collected-email field in Settings)
- `¿Su afiliación es personal o forma parte de la institución a la que usted pertenece?`
- `Página web de la organización:`
- `Unidad a la que pertenece dentro de la organización:`
- `Correo electrónico institucional:`
- `Perfil de LinkedIn (opcional):`
- `¿Por qué le interesa la innovación frugal?`
- `¿Por qué desea ser parte de la Red Latinoamericana de Innovación Frugal?`
- `¿En cuál de las siguientes comisiones le gustaría participar?`
- `¿En que tipos de iniciativas y proyectos le gustaría participar?`
- `¿Cómo considera que puedo aportar a estas iniciativas y proyectos?`
- `¿Hay iniciativas y proyectos que usted esté liderando o desee crear que se puedan trabajar junto con la Red?`
- Both WhatsApp questions

---

## Verification checklist

Before reporting done, confirm each of these in the editor:

- [ ] `Nombre completo` exists, Short answer, required
- [ ] `Organización:` is a Dropdown with 37 options, NOT required
- [ ] `Cargo dentro la organización:` is Multiple choice with exactly 5 options
- [ ] `País:` is a Dropdown with 21 options, required, in the representatives section
- [ ] `Región / Estado:` is a Dropdown with 84 options, required, directly below `País:`
- [ ] `Puesto:` Short answer, not required
- [ ] `Biografía` Paragraph, not required
- [ ] `Intereses` Checkboxes, 12 options, required
- [ ] `Áreas generales` Checkboxes, 10 options, required
- [ ] `Idiomas` Checkboxes, 6 options, required
- [ ] `Consentimiento` Checkboxes, exactly 1 option reading `Acepto`, required, last question in the form
- [ ] No question from Part D was renamed, retyped, reordered, or deleted
- [ ] `Nombre y apellidos completos:` no longer exists (it became `Nombre completo`)

Then submit the form once yourself with test answers, download the response CSV,
and confirm the header row contains all eleven titles above spelled identically.

---

## Known limitations — report these, do not try to solve them

1. **Organisations outside the list of 37 cannot be selected.** A member from an
   unlisted organisation leaves `Organización:` blank and is published as
   independent. Adding a new organisation requires a code change in
   `src/data/institutions.ts`, not a form edit.
2. **País and Región are independent dropdowns.** Google Forms has no dependent
   dropdowns, so nothing stops someone choosing `Perú` + `Jalisco`. That
   combination fails validation and the response waits in the admin panel for a
   human instead of publishing. This is intended behaviour, not a bug.
3. **The 58 existing responses will not import.** They predate these questions
   and have no consent answer. They remain readable in the Responses tab.
