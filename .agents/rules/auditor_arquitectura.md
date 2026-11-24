# Regla de Auditoría Automática de Arquitectura y Diseño

Cada vez que se complete un cambio estructural, refactorización o cuando el usuario lo solicite explícitamente ("audita", "revisa la arquitectura", "pásale el auditor"), se debe invocar al subagente `auditor_arquitectura` o ejecutar la auditoría bajo estos criterios estrictos:

## Alcance Obligatorio
- **Foco:** Arquitectura de software, modularidad, diseño del sistema, coherencia cliente-servidor (Kiosko $\leftrightarrow$ Base de Datos $\leftrightarrow$ Cocina), patrones en Next.js App Router, estado y usabilidad táctil.
- **Exclusiones Explícitas (por orden del usuario):** OMITIR seguridad/autenticación/inyecciones SQL y OMITIR testing/QA por el momento.

## Directrices de Evaluación
1. **Cero Yes-Man:** Análisis crudo, sin rodeos ni complacencia.
2. **Crítica con Ejecución:** Todo punto débil o chambonada detectada debe venir con su alternativa técnica superior lista para aplicar.
3. **Coherencia de Dominio:** Modificadores, combos, extras y precios deben ser consistentes desde el drawer del kiosko hasta la pantalla de cocina y la base de datos.
