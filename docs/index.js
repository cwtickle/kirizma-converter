'use strict'
const ver = 'Ver. 2025-09-08-0'

/**
 * 読み込み時の初期設定
 */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('version').innerText = ver
  document.getElementById('convert-button').addEventListener('click', kirizma_convert)
  document.getElementById('romaji-setting-preset').addEventListener('change', romaji_peset_changed)
  document.getElementById('option-kirizma-mode').addEventListener('change', option_kirizma_mode_changed)
  document.getElementById('option-use-number').addEventListener('change', set_actual_keymode)
  document.getElementById('option-use-alphabet').addEventListener('change', set_actual_keymode)
  document.getElementById('option-use-alphabet').disabled = true
})


/**
 * ローマ字変換規則プリセット設定
 */
const romaji_preset_item = 'じちふらん'.split('')
const romaji_preset = {
  'kunrei': 'ZTHRN'.split(''),  // 訓令式風
  'hepburn': 'JCFRN'.split('')   // ヘボン式風
}

// 選択変更時にチェック状態を変える
const romaji_peset_changed = e => {
  const selected = e.target.options[e.target.selectedIndex].id
  if (romaji_preset[selected]) {
    romaji_preset_item.forEach((kana, i) => {
      document.getElementsByName('romaji-' + kana).forEach(option => {
        option.checked = (option.value === romaji_preset[selected][i])
      })
    })
  }
  set_actual_keymode()
}

// かな/ローマ字切り替え時にアルファベット使用チェックボックスの有効/無効を切り替える
const option_kirizma_mode_changed = e => {
  const selected = e.target.options[e.target.selectedIndex].id
  const use_kana_alphabet = document.getElementById('option-use-alphabet')
  if (selected === 'kana') {
    use_kana_alphabet.disabled = false
  } else {
    use_kana_alphabet.disabled = true
    use_kana_alphabet.checked = false
  }
  set_actual_keymode()
}

// 実際のキーモード表示
const set_actual_keymode = () => {
  const modeSelect = document.getElementById('option-kirizma-mode')
  const mode = modeSelect.options[modeSelect.selectedIndex].id
  const useNumber = document.getElementById('option-use-number').checked
  const useKanaAlphabet = document.getElementById('option-use-alphabet').checked

  // キーモードの算出
  const defaultKeyMode = mode === 'romaji' ? '27k/31k' : '47k/51k'
  let actualKeyMode = ''

  if (mode === 'romaji') {
    actualKeyMode = useNumber ? '37k/41k' : '27k/31k'
  }
  if (mode === 'kana') {
    if (useKanaAlphabet) {
      actualKeyMode = useNumber ? '83k' : '73k'
    } else {
      actualKeyMode = useNumber ? '57k/61k' : '47k/51k'
    }
  }

  // DOMへの反映
  const targetEl = document.getElementById('actual-key-mode')
  targetEl.innerText = actualKeyMode
  targetEl.style.fontWeight = actualKeyMode === defaultKeyMode ? 'normal' : 'bold'
}


/**
 * 変換メイン
 */
const kirizma_convert = () => {
  // ローマ字/かな切り替え
  const mode_ = document.getElementById('option-kirizma-mode')
  const mode = mode_.options[mode_.selectedIndex].id
  const convert_char = mode === 'kana' ? convert_kana : convert_romaji

  // フリーズ識別子
  const frz_char = '＝'

  // 入力データ
  const input_dos = document.getElementById('input-dos').value
  let input_kana = document.getElementById('input-kana').value
    .replace(/[ａ-ｚＡ-Ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt() - 0xfee0)) // 半角化
    .replace(/[a-z]/g, s => String.fromCharCode(s.charCodeAt() - 0x20)) // 大文字化
    .replace(/[^あ-んA-Z0-9＝]|[ぁぃぅぇぉゃゅょっゐゑ]/g, '') // 使用可能なひらがな以外削除して配列にする

  // ローマ字変換規則
  const use_j = document.getElementById('romaji-じ-j').checked
  const use_c = document.getElementById('romaji-ち-c').checked
  const use_f = document.getElementById('romaji-ふ-f').checked
  const use_l = document.getElementById('romaji-ら-l').checked
  const use_x = document.getElementById('romaji-ん-x').checked

  // 譜面番号
  const in_score_no_ = document.getElementById('option-in-score-no').value
  const in_score_no = in_score_no_ === '1' ? '' : in_score_no_
  const out_score_no_ = document.getElementById('option-out-score-no').value
  const out_score_no = out_score_no_ === '1' ? '' : out_score_no_

  // 変換オプション
  const keep_onigiri = document.getElementById('option-keep-onigiri').checked
  const keep_4key = document.getElementById('option-keep-4key').checked
  const use_sleft = document.getElementById('option-use-sleft').checked
  const use_number = document.getElementById('option-use-number').checked
  const use_kana_alphabet = document.getElementById('option-use-alphabet').checked
  const conv_vowels = {
    A: `AA`, I: `II`, U: `UU`, E: `EE`, O: `OO`,
  };

  // 通常は入力文字から英字を外す
  if (!(mode === `kana` && use_kana_alphabet)) {
    input_kana = input_kana.replace(/[A-Z]/g, '')
  }
  // 数字が変換対象で無いときは数字を外す
  if (!use_number) {
    input_kana = input_kana.replace(/[0-9]/g, '')
  }
  const input_kana_arr = input_kana.split('')

  // かなモード＆アルファベット使用時のテーブルと変数の拡張
  kana_vars = structuredClone(base_kana_vars)
  kana_table = structuredClone(base_kana_table)

  if (mode === `kana` && use_kana_alphabet) {
    // 1. まず先に、ひらがな用テーブルと変数に対して母音の重複変換（conv_vowels）を適用する
    kana_vars = kana_vars.map((v) => conv_vowels[v] || v);

    Object.keys(kana_table).forEach(key => {
      kana_table[key] = conv_vowels[kana_table[key]] || kana_table[key];
    });

    // 2. その後で、変換されない（AAにならない）そのままのアルファベットをテーブルと変数に追加する
    org_romaji_vars.forEach(c => {
      if (!kana_table[c]) kana_table[c] = c;
      if (!kana_vars.includes(c)) kana_vars.push(c);
    });
  }
  const target_vars = mode === 'kana' ? kana_vars : romaji_vars

  // 譜面データの前処理
  const dos_obj = input_dos
    .replace(/\r|\n/g, '')     // 改行削除
    .replace(/&/g, '|')        // & と | に統一
    .replace(/^\|+|\|+$/g, '') // 先頭と末尾の | を削除
    .split('|')                // | で分割
    .map(s => s.split('='))    // = で分割 (left_data=200,300,400 -> ['left_data','200,300,400'])
    .filter(a => a[0].match(new RegExp('[^0-9]' + in_score_no + '_data$')))  // 指定した入力譜面番号のデータを抽出

  // 除外する変数名
  const ignore = 'acolor,color,ncolor,word,back,mask,arrowMotion,frzMotion'.split(',')

  // おにぎり等をそのまま残す処理
  const keep_data = {}
  const keep = (name) => {
    ignore.push(name)
    const data = dos_obj.find(a => a[0].match(new RegExp('^' + name)))
    if (data) {
      keep_data[name] = data[1]
    } else {
      keep_data[name] = ''
    }
  }

  ['speed', 'boost'].forEach(keep)

  if (keep_onigiri) {
    ['space', 'frzSpace'].forEach(keep)
  }
  if (keep_4key) {
    if (use_sleft) {
      ['sleft', 'sdown', 'sup', 'sright', 'sfrzLeft', 'sfrzDown', 'sfrzUp', 'sfrzRight'].forEach(keep)
    } else {
      ['left', 'down', 'up', 'right', 'frzLeft', 'frzDown', 'frzUp', 'frzRight'].forEach(keep)
    }
  }

  // タイミングデータ
  const frames = dos_obj.filter(
    a => a[1] !== '' &&  // 空白は無視
      !a[0].match(         // 要らない変数を除外
        new RegExp(ignore.map(name => name + in_score_no + '_data').join('|'))
      )
  )
    .reduce((acc, val) => acc.concat(val[1].split(',')), []) // フレーム値を分割して1つの配列にまとめる
    .map(s => parseInt(s))  // 文字列になってるので数値にする
    .sort((a, b) => a - b)  // 昇順で並べ替え

  // キーごとのデータを生成
  const out_data = {}
  const out_frz_data = {}
  target_vars.forEach(name => out_data[name] = [])
  target_vars.forEach(name => out_frz_data[name] = [])

  frames.forEach((frame, i) => {
    if (input_kana_arr[i] === frz_char) {
      // フリーズ識別子の場合はスキップ
      return
    }

    if (input_kana_arr[i + 1] && input_kana_arr[i + 1] === frz_char) {
      // 直後がフリーズ識別子の場合は自身とその次のデータをフリーズノートへ割当
      out_frz_data[convert_char(input_kana_arr[i], use_j, use_c, use_f, use_l, use_x)].push(frame, frames[i + 1])
    } else if (input_kana_arr[i]) {
      // それ以外は矢印へ割当
      out_data[convert_char(input_kana_arr[i], use_j, use_c, use_f, use_l, use_x)].push(frame)
    }
  })

  // 出力譜面データの生成
  let out_str =
    '|' + target_vars
      .map(name => 'key' + name + out_score_no + '_data=' + out_data[name].join(','))
      .join('|') + '|'
  out_str +=
    '\n|' + target_vars
      .map(name => 'frzKey' + name + out_score_no + '_data=' + out_frz_data[name].join(','))
      .join('|') + '|'

  // キープしたおにぎり等を戻す
  if (keep_4key) {
    ['left', 'down', 'up', 'right', 'frzLeft', 'frzDown', 'frzUp', 'frzRight'].forEach(name => {
      out_str += name + out_score_no + '_data=' + keep_data[(use_sleft ? 's' : '') + name] + '|'
    })
  }
  if (keep_onigiri) {
    out_str += 'space' + out_score_no + '_data=' + keep_data['space'] + '|'
    out_str += 'frzSpace' + out_score_no + '_data=' + keep_data['frzSpace'] + '|'
  }

  out_str += 'speed' + out_score_no + '_data=' + keep_data['speed'] + '|'
  out_str += 'boost' + out_score_no + '_data=' + keep_data['boost'] + '|'

  navigator.clipboard.writeText(out_str)
  document.getElementById('convert-result').className = ''
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('convert-result').className = 'convert-result-animation'
    })
  })
}


/**
 * 文字単位の変換
 */
const convert_romaji = (char, j, c, f, l, x) => {
  if (char === 'じ' && j) { return 'J' }
  if (char === 'ち' && c) { return 'C' }
  if (char === 'ふ' && f) { return 'F' }
  if (char.match(/^[ら-ろ]$/) && l) { return 'L' }
  if (char === 'ん' && x) { return 'X' }
  return romaji_table[char]
}

const convert_kana = char => kana_table[char]


/**
 * 定数
 */
// 出力譜面データの変数名生成用
const romaji_vars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const base_kana_vars = [
  'A', 'I', 'U', 'E', 'O',
  'KA', 'KI', 'KU', 'KE', 'KO',
  'SA', 'SI', 'SU', 'SE', 'SO',
  'TA', 'TI', 'TU', 'TE', 'TO',
  'NA', 'NI', 'NU', 'NE', 'NO',
  'HA', 'HI', 'HU', 'HE', 'HO',
  'MA', 'MI', 'MU', 'ME', 'MO',
  'YA', 'YU', 'YO',
  'RA', 'RI', 'RU', 'RE', 'RO',
  'WA', 'WO', 'NN'
]
let kana_vars

// ローマ字時の変数名への変換表(デフォルト)
const romaji_table = {
  'あ': 'A', 'い': 'I', 'う': 'U', 'え': 'E', 'お': 'O',
  'か': 'K', 'き': 'K', 'く': 'K', 'け': 'K', 'こ': 'K',
  'さ': 'S', 'し': 'S', 'す': 'S', 'せ': 'S', 'そ': 'S',
  'た': 'T', 'ち': 'T', 'つ': 'T', 'て': 'T', 'と': 'T',
  'な': 'N', 'に': 'N', 'ぬ': 'N', 'ね': 'N', 'の': 'N',
  'は': 'H', 'ひ': 'H', 'ふ': 'H', 'へ': 'H', 'ほ': 'H',
  'ま': 'M', 'み': 'M', 'む': 'M', 'め': 'M', 'も': 'M',
  'や': 'Y', 'ゆ': 'Y', 'よ': 'Y',
  'ら': 'R', 'り': 'R', 'る': 'R', 'れ': 'R',
  'ろ': 'R', 'わ': 'W', 'を': 'W', 'ん': 'N',
  'が': 'G', 'ぎ': 'G', 'ぐ': 'G', 'げ': 'G', 'ご': 'G',
  'ざ': 'Z', 'じ': 'Z', 'ず': 'Z', 'ぜ': 'Z', 'ぞ': 'Z',
  'だ': 'D', 'ぢ': 'D', 'づ': 'D', 'で': 'D', 'ど': 'D',
  'ば': 'B', 'び': 'B', 'ぶ': 'B', 'べ': 'B', 'ぼ': 'B',
  'ぱ': 'P', 'ぴ': 'P', 'ぷ': 'P', 'ぺ': 'P', 'ぽ': 'P',
  '0': 'ZERO', '1': 'ONE', '2': 'TWO', '3': 'THREE', '4': 'FOUR',
  '5': 'FIVE', '6': 'SIX', '7': 'SEVEN', '8': 'EIGHT', '9': 'NINE'
}

const org_romaji_vars = romaji_vars.concat()
org_romaji_vars.forEach(c => romaji_table[c] = c)
romaji_vars.push('ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE')
base_kana_vars.push('ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE')

// かな入力時の変数名への変換表(デフォルト)
const base_kana_table = {
  'あ': 'A', 'い': 'I', 'う': 'U', 'え': 'E', 'お': 'O',
  'か': 'KA', 'き': 'KI', 'く': 'KU', 'け': 'KE', 'こ': 'KO',
  'さ': 'SA', 'し': 'SI', 'す': 'SU', 'せ': 'SE', 'そ': 'SO',
  'た': 'TA', 'ち': 'TI', 'つ': 'TU', 'て': 'TE', 'と': 'TO',
  'な': 'NA', 'に': 'NI', 'ぬ': 'NU', 'ね': 'NE', 'の': 'NO',
  'は': 'HA', 'ひ': 'HI', 'ふ': 'HU', 'へ': 'HE', 'ほ': 'HO',
  'ま': 'MA', 'み': 'MI', 'む': 'MU', 'め': 'ME', 'も': 'MO',
  'や': 'YA', 'ゆ': 'YU', 'よ': 'YO',
  'ら': 'RA', 'り': 'RI', 'る': 'RU', 'れ': 'RE', 'ろ': 'RO',
  'わ': 'WA', 'を': 'WO', 'ん': 'NN',
  'が': 'KA', 'ぎ': 'KI', 'ぐ': 'KU', 'げ': 'KE', 'ご': 'KO',
  'ざ': 'SA', 'じ': 'SI', 'ず': 'SU', 'ぜ': 'SE', 'ぞ': 'SO',
  'だ': 'TA', 'ぢ': 'TI', 'づ': 'TU', 'で': 'TE', 'ど': 'TO',
  'ば': 'HA', 'び': 'HI', 'ぶ': 'HU', 'べ': 'HE', 'ぼ': 'HO',
  'ぱ': 'HA', 'ぴ': 'HI', 'ぷ': 'HU', 'ぺ': 'HE', 'ぽ': 'HO',
  '0': 'ZERO', '1': 'ONE', '2': 'TWO', '3': 'THREE', '4': 'FOUR',
  '5': 'FIVE', '6': 'SIX', '7': 'SEVEN', '8': 'EIGHT', '9': 'NINE',
}
let kana_table
