export class Runner {
  constructor() {
    this.pass = 0
    this.fail = 0
    this.skip = 0
    this.failures = []
  }

  ok(id, description) {
    console.log(`  PASS ${id} ${description}`)
    this.pass++
  }

  fail_(id, description, reason) {
    console.log(`  FAIL ${id} ${description}`)
    if (reason) console.log(`       → ${reason}`)
    this.fail++
    this.failures.push({ id, description, reason })
  }

  skip_(id, description, reason) {
    console.log(`  SKIP ${id} ${description}`)
    if (reason) console.log(`       (${reason})`)
    this.skip++
  }

  async section(name, fn) {
    console.log(`\n[${name}]`)
    try {
      await fn(this)
    } catch (err) {
      console.error(`  ERROR in section ${name}:`, err.message)
    }
  }

  async check(id, description, fn) {
    try {
      await fn()
      this.ok(id, description)
    } catch (err) {
      this.fail_(id, description, err.message)
    }
  }

  assert(condition, message) {
    if (!condition) throw new Error(message ?? 'assertion failed')
  }

  summary() {
    console.log('\n================================')
    console.log('FoodKit QA Smoke')
    console.log(`PASS: ${this.pass}`)
    console.log(`FAIL: ${this.fail}`)
    console.log(`SKIP: ${this.skip}`)
    console.log('================================')
    if (this.failures.length > 0) {
      console.log('\nFailed tests:')
      for (const f of this.failures) {
        console.log(`  ${f.id} — ${f.description}`)
        if (f.reason) console.log(`           ${f.reason}`)
      }
    }
    if (this.fail > 0) process.exitCode = 1
  }
}
