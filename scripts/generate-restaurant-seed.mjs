import fs from 'fs'

const AREAS = new Set([
  '飯塚市中心部',
  '新飯塚',
  '穂波',
  '二瀬',
  '幸袋',
  '頴田',
  '筑穂',
  '庄内',
  '桂川',
  '嘉麻',
  '田川',
  'その他',
])

const GENRES = new Set([
  'ラーメン',
  '定食・食堂',
  '居酒屋',
  'カフェ',
  '喫茶',
  '丼・カレー',
  'うどん・そば',
  '焼肉',
  '中華',
  'イタリアン',
  '洋食',
  '寿司・海鮮',
  'パン・スイーツ',
  'ファストフード',
  'その他',
])

const REQUIRED_COLUMNS = ['name', 'area', 'genre', 'address']
const EXPECTED_COUNT = 50

function parseCsv(input) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]

    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('CSVの引用符が閉じられていません')
  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }

  return rows.filter((values) => values.some((value) => value.trim() !== ''))
}

function loadRestaurants(csv) {
  const rows = parseCsv(csv)
  if (rows.length === 0) throw new Error('CSVが空です')

  const headers = rows[0].map((header) => header.trim())
  if (headers.some((header) => header === '')) {
    throw new Error('CSVのヘッダーに名前のない列があります')
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error('CSVのヘッダーに同じ列名が複数あります')
  }
  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) throw new Error(`必須列 ${column} がありません`)
  }

  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `${index + 2}行目: 列数がヘッダーと一致しません（${values.length}列 / ${headers.length}列）`,
      )
    }
    const restaurant = Object.fromEntries(
      headers.map((header, columnIndex) => [
        header,
        (values[columnIndex] === undefined ? '' : values[columnIndex]).trim(),
      ]),
    )
    return { ...restaurant, line: index + 2 }
  })
}

function validateRestaurants(restaurants) {
  const errors = []
  const duplicateKeys = new Map()

  for (const restaurant of restaurants) {
    for (const column of REQUIRED_COLUMNS) {
      if (!restaurant[column]) errors.push(`${restaurant.line}行目: ${column}が空です`)
    }

    if (restaurant.area && !AREAS.has(restaurant.area)) {
      errors.push(`${restaurant.line}行目: エリア「${restaurant.area}」は固定語彙外です`)
    }
    if (restaurant.genre && !GENRES.has(restaurant.genre)) {
      errors.push(`${restaurant.line}行目: ジャンル「${restaurant.genre}」は固定語彙外です`)
    }
    if (restaurant.address && !restaurant.address.startsWith('福岡県')) {
      errors.push(`${restaurant.line}行目: 住所は「福岡県」から入力してください`)
    }
    if (
      REQUIRED_COLUMNS.some((column) =>
        /[\r\n]/.test(restaurant[column] === undefined ? '' : restaurant[column]),
      )
    ) {
      errors.push(`${restaurant.line}行目: 必須項目に改行を含めないでください`)
    }

    const duplicateKey = `${restaurant.name.toLocaleLowerCase('ja-JP')}\u0000${restaurant.area}`
    const previousLine = duplicateKeys.get(duplicateKey)
    if (previousLine) {
      errors.push(`${restaurant.line}行目: ${previousLine}行目と店名＋エリアが重複しています`)
    } else {
      duplicateKeys.set(duplicateKey, restaurant.line)
    }
  }

  return errors
}

function sqlString(value) {
  return `'${value.split("'").join("''")}'`
}

function generateSql(restaurants) {
  const values = restaurants
    .map(
      ({ name, area, genre, address }) =>
        `    (${[name, area, genre, address].map(sqlString).join(', ')})`,
    )
    .join(',\n')

  return `-- G1: 飯塚周辺の店舗マスタ投入（${restaurants.length}件）
-- restaurant_sourceへのseed追加とcreated_byのnullable化は
-- 20260809000700_prepare_seed_restaurants.sqlで実施済み。

insert into public.restaurants (name, area, genre, address, source, created_by)
select v.name, v.area, v.genre, v.address, 'seed', null
from (
  values
${values}
) as v(name, area, genre, address)
where not exists (
  select 1
  from public.restaurants r
  where lower(r.name) = lower(v.name)
    and r.area = v.area
);
`
}

function printUsage() {
  console.error(
    '使い方:\n' +
      '  検証: node scripts/generate-restaurant-seed.mjs --check data/restaurants.csv\n' +
      '  生成: node scripts/generate-restaurant-seed.mjs data/restaurants.csv supabase/migrations/20260809000701_seed_restaurants.sql',
  )
}

async function main() {
  const args = process.argv.slice(2)
  const checkOnly = args[0] === '--check'
  const inputPath = checkOnly ? args[1] : args[0]
  const outputPath = checkOnly ? undefined : args[1]

  if (!inputPath || (!checkOnly && !outputPath)) {
    printUsage()
    process.exitCode = 1
    return
  }

  try {
    const restaurants = loadRestaurants(await fs.promises.readFile(inputPath, 'utf8'))
    const errors = validateRestaurants(restaurants)
    if (errors.length > 0) throw new Error(errors.join('\n'))

    if (checkOnly) {
      console.log(`検証成功: ${restaurants.length}件（目標${EXPECTED_COUNT}件）`)
    } else {
      if (restaurants.length !== EXPECTED_COUNT) {
        throw new Error(`SQL生成には${EXPECTED_COUNT}件必要です（現在${restaurants.length}件）`)
      }
      await fs.promises.writeFile(outputPath, generateSql(restaurants), 'utf8')
      console.log(`SQL生成成功: ${restaurants.length}件 → ${outputPath}`)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

main()
