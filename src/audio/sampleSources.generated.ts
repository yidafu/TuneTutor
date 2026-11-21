/**
 * 构建期生成（scripts/generateSampleSources.mjs）——勿手改。
 * 升级任一 tonejs-instrument-*-mp3 包后必须重跑该脚本并提交此文件
 * （tests/audio/sampleSources.test.ts 按 node_modules 现状校验新鲜度）。
 *
 * docs/audio.md §4 / 决策 A20：12 个采样包退化为纯 mp3 资源源，包 JS 不再被导入
 * （原包构造函数吞掉 onerror 的缺陷不再经过）；CDN 走 jsdelivr 版本化 URL
 * （CORS + immutable 一年缓存），bundled 为同源打包资产 URL（CDN 失效兜底）。
 */
import type { InstrumentType } from '../types/audio'

import pianoA1 from 'tonejs-instrument-piano-mp3/A1.mp3'
import pianoA2 from 'tonejs-instrument-piano-mp3/A2.mp3'
import pianoA3 from 'tonejs-instrument-piano-mp3/A3.mp3'
import pianoA4 from 'tonejs-instrument-piano-mp3/A4.mp3'
import pianoA5 from 'tonejs-instrument-piano-mp3/A5.mp3'
import pianoA6 from 'tonejs-instrument-piano-mp3/A6.mp3'
import pianoA7 from 'tonejs-instrument-piano-mp3/A7.mp3'
import pianoAs1 from 'tonejs-instrument-piano-mp3/As1.mp3'
import pianoAs2 from 'tonejs-instrument-piano-mp3/As2.mp3'
import pianoAs3 from 'tonejs-instrument-piano-mp3/As3.mp3'
import pianoAs4 from 'tonejs-instrument-piano-mp3/As4.mp3'
import pianoAs5 from 'tonejs-instrument-piano-mp3/As5.mp3'
import pianoAs6 from 'tonejs-instrument-piano-mp3/As6.mp3'
import pianoAs7 from 'tonejs-instrument-piano-mp3/As7.mp3'
import pianoB1 from 'tonejs-instrument-piano-mp3/B1.mp3'
import pianoB2 from 'tonejs-instrument-piano-mp3/B2.mp3'
import pianoB3 from 'tonejs-instrument-piano-mp3/B3.mp3'
import pianoB4 from 'tonejs-instrument-piano-mp3/B4.mp3'
import pianoB5 from 'tonejs-instrument-piano-mp3/B5.mp3'
import pianoB6 from 'tonejs-instrument-piano-mp3/B6.mp3'
import pianoB7 from 'tonejs-instrument-piano-mp3/B7.mp3'
import pianoC1 from 'tonejs-instrument-piano-mp3/C1.mp3'
import pianoC2 from 'tonejs-instrument-piano-mp3/C2.mp3'
import pianoC3 from 'tonejs-instrument-piano-mp3/C3.mp3'
import pianoC4 from 'tonejs-instrument-piano-mp3/C4.mp3'
import pianoC5 from 'tonejs-instrument-piano-mp3/C5.mp3'
import pianoC6 from 'tonejs-instrument-piano-mp3/C6.mp3'
import pianoC7 from 'tonejs-instrument-piano-mp3/C7.mp3'
import pianoC8 from 'tonejs-instrument-piano-mp3/C8.mp3'
import pianoCs1 from 'tonejs-instrument-piano-mp3/Cs1.mp3'
import pianoCs2 from 'tonejs-instrument-piano-mp3/Cs2.mp3'
import pianoCs3 from 'tonejs-instrument-piano-mp3/Cs3.mp3'
import pianoCs4 from 'tonejs-instrument-piano-mp3/Cs4.mp3'
import pianoCs5 from 'tonejs-instrument-piano-mp3/Cs5.mp3'
import pianoCs6 from 'tonejs-instrument-piano-mp3/Cs6.mp3'
import pianoCs7 from 'tonejs-instrument-piano-mp3/Cs7.mp3'
import pianoD1 from 'tonejs-instrument-piano-mp3/D1.mp3'
import pianoD2 from 'tonejs-instrument-piano-mp3/D2.mp3'
import pianoD3 from 'tonejs-instrument-piano-mp3/D3.mp3'
import pianoD4 from 'tonejs-instrument-piano-mp3/D4.mp3'
import pianoD5 from 'tonejs-instrument-piano-mp3/D5.mp3'
import pianoD6 from 'tonejs-instrument-piano-mp3/D6.mp3'
import pianoD7 from 'tonejs-instrument-piano-mp3/D7.mp3'
import pianoDs1 from 'tonejs-instrument-piano-mp3/Ds1.mp3'
import pianoDs2 from 'tonejs-instrument-piano-mp3/Ds2.mp3'
import pianoDs3 from 'tonejs-instrument-piano-mp3/Ds3.mp3'
import pianoDs4 from 'tonejs-instrument-piano-mp3/Ds4.mp3'
import pianoDs5 from 'tonejs-instrument-piano-mp3/Ds5.mp3'
import pianoDs6 from 'tonejs-instrument-piano-mp3/Ds6.mp3'
import pianoDs7 from 'tonejs-instrument-piano-mp3/Ds7.mp3'
import pianoE1 from 'tonejs-instrument-piano-mp3/E1.mp3'
import pianoE2 from 'tonejs-instrument-piano-mp3/E2.mp3'
import pianoE3 from 'tonejs-instrument-piano-mp3/E3.mp3'
import pianoE4 from 'tonejs-instrument-piano-mp3/E4.mp3'
import pianoE5 from 'tonejs-instrument-piano-mp3/E5.mp3'
import pianoE6 from 'tonejs-instrument-piano-mp3/E6.mp3'
import pianoE7 from 'tonejs-instrument-piano-mp3/E7.mp3'
import pianoF1 from 'tonejs-instrument-piano-mp3/F1.mp3'
import pianoF2 from 'tonejs-instrument-piano-mp3/F2.mp3'
import pianoF3 from 'tonejs-instrument-piano-mp3/F3.mp3'
import pianoF4 from 'tonejs-instrument-piano-mp3/F4.mp3'
import pianoF5 from 'tonejs-instrument-piano-mp3/F5.mp3'
import pianoF6 from 'tonejs-instrument-piano-mp3/F6.mp3'
import pianoF7 from 'tonejs-instrument-piano-mp3/F7.mp3'
import pianoFs1 from 'tonejs-instrument-piano-mp3/Fs1.mp3'
import pianoFs2 from 'tonejs-instrument-piano-mp3/Fs2.mp3'
import pianoFs3 from 'tonejs-instrument-piano-mp3/Fs3.mp3'
import pianoFs4 from 'tonejs-instrument-piano-mp3/Fs4.mp3'
import pianoFs5 from 'tonejs-instrument-piano-mp3/Fs5.mp3'
import pianoFs6 from 'tonejs-instrument-piano-mp3/Fs6.mp3'
import pianoFs7 from 'tonejs-instrument-piano-mp3/Fs7.mp3'
import pianoG1 from 'tonejs-instrument-piano-mp3/G1.mp3'
import pianoG2 from 'tonejs-instrument-piano-mp3/G2.mp3'
import pianoG3 from 'tonejs-instrument-piano-mp3/G3.mp3'
import pianoG4 from 'tonejs-instrument-piano-mp3/G4.mp3'
import pianoG5 from 'tonejs-instrument-piano-mp3/G5.mp3'
import pianoG6 from 'tonejs-instrument-piano-mp3/G6.mp3'
import pianoG7 from 'tonejs-instrument-piano-mp3/G7.mp3'
import pianoGs1 from 'tonejs-instrument-piano-mp3/Gs1.mp3'
import pianoGs2 from 'tonejs-instrument-piano-mp3/Gs2.mp3'
import pianoGs3 from 'tonejs-instrument-piano-mp3/Gs3.mp3'
import pianoGs4 from 'tonejs-instrument-piano-mp3/Gs4.mp3'
import pianoGs5 from 'tonejs-instrument-piano-mp3/Gs5.mp3'
import pianoGs6 from 'tonejs-instrument-piano-mp3/Gs6.mp3'
import pianoGs7 from 'tonejs-instrument-piano-mp3/Gs7.mp3'
import saxophoneA4 from 'tonejs-instrument-saxophone-mp3/A4.mp3'
import saxophoneA5 from 'tonejs-instrument-saxophone-mp3/A5.mp3'
import saxophoneAs3 from 'tonejs-instrument-saxophone-mp3/As3.mp3'
import saxophoneAs4 from 'tonejs-instrument-saxophone-mp3/As4.mp3'
import saxophoneB3 from 'tonejs-instrument-saxophone-mp3/B3.mp3'
import saxophoneB4 from 'tonejs-instrument-saxophone-mp3/B4.mp3'
import saxophoneC4 from 'tonejs-instrument-saxophone-mp3/C4.mp3'
import saxophoneC5 from 'tonejs-instrument-saxophone-mp3/C5.mp3'
import saxophoneCs3 from 'tonejs-instrument-saxophone-mp3/Cs3.mp3'
import saxophoneCs4 from 'tonejs-instrument-saxophone-mp3/Cs4.mp3'
import saxophoneCs5 from 'tonejs-instrument-saxophone-mp3/Cs5.mp3'
import saxophoneD3 from 'tonejs-instrument-saxophone-mp3/D3.mp3'
import saxophoneD4 from 'tonejs-instrument-saxophone-mp3/D4.mp3'
import saxophoneD5 from 'tonejs-instrument-saxophone-mp3/D5.mp3'
import saxophoneDs3 from 'tonejs-instrument-saxophone-mp3/Ds3.mp3'
import saxophoneDs4 from 'tonejs-instrument-saxophone-mp3/Ds4.mp3'
import saxophoneDs5 from 'tonejs-instrument-saxophone-mp3/Ds5.mp3'
import saxophoneE3 from 'tonejs-instrument-saxophone-mp3/E3.mp3'
import saxophoneE4 from 'tonejs-instrument-saxophone-mp3/E4.mp3'
import saxophoneE5 from 'tonejs-instrument-saxophone-mp3/E5.mp3'
import saxophoneF3 from 'tonejs-instrument-saxophone-mp3/F3.mp3'
import saxophoneF4 from 'tonejs-instrument-saxophone-mp3/F4.mp3'
import saxophoneF5 from 'tonejs-instrument-saxophone-mp3/F5.mp3'
import saxophoneFs3 from 'tonejs-instrument-saxophone-mp3/Fs3.mp3'
import saxophoneFs4 from 'tonejs-instrument-saxophone-mp3/Fs4.mp3'
import saxophoneFs5 from 'tonejs-instrument-saxophone-mp3/Fs5.mp3'
import saxophoneG3 from 'tonejs-instrument-saxophone-mp3/G3.mp3'
import saxophoneG4 from 'tonejs-instrument-saxophone-mp3/G4.mp3'
import saxophoneG5 from 'tonejs-instrument-saxophone-mp3/G5.mp3'
import saxophoneGs3 from 'tonejs-instrument-saxophone-mp3/Gs3.mp3'
import saxophoneGs4 from 'tonejs-instrument-saxophone-mp3/Gs4.mp3'
import saxophoneGs5 from 'tonejs-instrument-saxophone-mp3/Gs5.mp3'
import clarinetAs3 from 'tonejs-instrument-clarinet-mp3/As3.mp3'
import clarinetAs4 from 'tonejs-instrument-clarinet-mp3/As4.mp3'
import clarinetAs5 from 'tonejs-instrument-clarinet-mp3/As5.mp3'
import clarinetD3 from 'tonejs-instrument-clarinet-mp3/D3.mp3'
import clarinetD4 from 'tonejs-instrument-clarinet-mp3/D4.mp3'
import clarinetD5 from 'tonejs-instrument-clarinet-mp3/D5.mp3'
import clarinetD6 from 'tonejs-instrument-clarinet-mp3/D6.mp3'
import clarinetF3 from 'tonejs-instrument-clarinet-mp3/F3.mp3'
import clarinetF4 from 'tonejs-instrument-clarinet-mp3/F4.mp3'
import clarinetF5 from 'tonejs-instrument-clarinet-mp3/F5.mp3'
import clarinetFs6 from 'tonejs-instrument-clarinet-mp3/Fs6.mp3'
import fluteA4 from 'tonejs-instrument-flute-mp3/A4.mp3'
import fluteA5 from 'tonejs-instrument-flute-mp3/A5.mp3'
import fluteA6 from 'tonejs-instrument-flute-mp3/A6.mp3'
import fluteC4 from 'tonejs-instrument-flute-mp3/C4.mp3'
import fluteC5 from 'tonejs-instrument-flute-mp3/C5.mp3'
import fluteC6 from 'tonejs-instrument-flute-mp3/C6.mp3'
import fluteC7 from 'tonejs-instrument-flute-mp3/C7.mp3'
import fluteE4 from 'tonejs-instrument-flute-mp3/E4.mp3'
import fluteE5 from 'tonejs-instrument-flute-mp3/E5.mp3'
import fluteE6 from 'tonejs-instrument-flute-mp3/E6.mp3'
import trumpetA3 from 'tonejs-instrument-trumpet-mp3/A3.mp3'
import trumpetA5 from 'tonejs-instrument-trumpet-mp3/A5.mp3'
import trumpetAs3 from 'tonejs-instrument-trumpet-mp3/As3.mp3'
import trumpetC3 from 'tonejs-instrument-trumpet-mp3/C3.mp3'
import trumpetC6 from 'tonejs-instrument-trumpet-mp3/C6.mp3'
import trumpetD5 from 'tonejs-instrument-trumpet-mp3/D5.mp3'
import trumpetDs4 from 'tonejs-instrument-trumpet-mp3/Ds4.mp3'
import trumpetF3 from 'tonejs-instrument-trumpet-mp3/F3.mp3'
import trumpetF4 from 'tonejs-instrument-trumpet-mp3/F4.mp3'
import trumpetF5 from 'tonejs-instrument-trumpet-mp3/F5.mp3'
import trumpetG4 from 'tonejs-instrument-trumpet-mp3/G4.mp3'
import frenchHornA1 from 'tonejs-instrument-french-horn-mp3/A1.mp3'
import frenchHornA3 from 'tonejs-instrument-french-horn-mp3/A3.mp3'
import frenchHornC2 from 'tonejs-instrument-french-horn-mp3/C2.mp3'
import frenchHornC4 from 'tonejs-instrument-french-horn-mp3/C4.mp3'
import frenchHornD3 from 'tonejs-instrument-french-horn-mp3/D3.mp3'
import frenchHornD5 from 'tonejs-instrument-french-horn-mp3/D5.mp3'
import frenchHornDs2 from 'tonejs-instrument-french-horn-mp3/Ds2.mp3'
import frenchHornF3 from 'tonejs-instrument-french-horn-mp3/F3.mp3'
import frenchHornF5 from 'tonejs-instrument-french-horn-mp3/F5.mp3'
import frenchHornG2 from 'tonejs-instrument-french-horn-mp3/G2.mp3'
import tromboneAs1 from 'tonejs-instrument-trombone-mp3/As1.mp3'
import tromboneAs2 from 'tonejs-instrument-trombone-mp3/As2.mp3'
import tromboneAs3 from 'tonejs-instrument-trombone-mp3/As3.mp3'
import tromboneC3 from 'tonejs-instrument-trombone-mp3/C3.mp3'
import tromboneC4 from 'tonejs-instrument-trombone-mp3/C4.mp3'
import tromboneCs2 from 'tonejs-instrument-trombone-mp3/Cs2.mp3'
import tromboneCs4 from 'tonejs-instrument-trombone-mp3/Cs4.mp3'
import tromboneD3 from 'tonejs-instrument-trombone-mp3/D3.mp3'
import tromboneD4 from 'tonejs-instrument-trombone-mp3/D4.mp3'
import tromboneDs2 from 'tonejs-instrument-trombone-mp3/Ds2.mp3'
import tromboneDs3 from 'tonejs-instrument-trombone-mp3/Ds3.mp3'
import tromboneDs4 from 'tonejs-instrument-trombone-mp3/Ds4.mp3'
import tromboneF2 from 'tonejs-instrument-trombone-mp3/F2.mp3'
import tromboneF3 from 'tonejs-instrument-trombone-mp3/F3.mp3'
import tromboneF4 from 'tonejs-instrument-trombone-mp3/F4.mp3'
import tromboneGs2 from 'tonejs-instrument-trombone-mp3/Gs2.mp3'
import tromboneGs3 from 'tonejs-instrument-trombone-mp3/Gs3.mp3'
import violinA3 from 'tonejs-instrument-violin-mp3/A3.mp3'
import violinA4 from 'tonejs-instrument-violin-mp3/A4.mp3'
import violinA5 from 'tonejs-instrument-violin-mp3/A5.mp3'
import violinA6 from 'tonejs-instrument-violin-mp3/A6.mp3'
import violinC4 from 'tonejs-instrument-violin-mp3/C4.mp3'
import violinC5 from 'tonejs-instrument-violin-mp3/C5.mp3'
import violinC6 from 'tonejs-instrument-violin-mp3/C6.mp3'
import violinC7 from 'tonejs-instrument-violin-mp3/C7.mp3'
import violinE4 from 'tonejs-instrument-violin-mp3/E4.mp3'
import violinE5 from 'tonejs-instrument-violin-mp3/E5.mp3'
import violinE6 from 'tonejs-instrument-violin-mp3/E6.mp3'
import violinG3 from 'tonejs-instrument-violin-mp3/G3.mp3'
import violinG4 from 'tonejs-instrument-violin-mp3/G4.mp3'
import violinG5 from 'tonejs-instrument-violin-mp3/G5.mp3'
import violinG6 from 'tonejs-instrument-violin-mp3/G6.mp3'
import celloA2 from 'tonejs-instrument-cello-mp3/A2.mp3'
import celloA3 from 'tonejs-instrument-cello-mp3/A3.mp3'
import celloA4 from 'tonejs-instrument-cello-mp3/A4.mp3'
import celloAs2 from 'tonejs-instrument-cello-mp3/As2.mp3'
import celloAs3 from 'tonejs-instrument-cello-mp3/As3.mp3'
import celloAs4 from 'tonejs-instrument-cello-mp3/As4.mp3'
import celloB2 from 'tonejs-instrument-cello-mp3/B2.mp3'
import celloB3 from 'tonejs-instrument-cello-mp3/B3.mp3'
import celloB4 from 'tonejs-instrument-cello-mp3/B4.mp3'
import celloC2 from 'tonejs-instrument-cello-mp3/C2.mp3'
import celloC3 from 'tonejs-instrument-cello-mp3/C3.mp3'
import celloC4 from 'tonejs-instrument-cello-mp3/C4.mp3'
import celloC5 from 'tonejs-instrument-cello-mp3/C5.mp3'
import celloCs3 from 'tonejs-instrument-cello-mp3/Cs3.mp3'
import celloCs4 from 'tonejs-instrument-cello-mp3/Cs4.mp3'
import celloD2 from 'tonejs-instrument-cello-mp3/D2.mp3'
import celloD3 from 'tonejs-instrument-cello-mp3/D3.mp3'
import celloD4 from 'tonejs-instrument-cello-mp3/D4.mp3'
import celloDs2 from 'tonejs-instrument-cello-mp3/Ds2.mp3'
import celloDs3 from 'tonejs-instrument-cello-mp3/Ds3.mp3'
import celloDs4 from 'tonejs-instrument-cello-mp3/Ds4.mp3'
import celloE2 from 'tonejs-instrument-cello-mp3/E2.mp3'
import celloE3 from 'tonejs-instrument-cello-mp3/E3.mp3'
import celloE4 from 'tonejs-instrument-cello-mp3/E4.mp3'
import celloF2 from 'tonejs-instrument-cello-mp3/F2.mp3'
import celloF3 from 'tonejs-instrument-cello-mp3/F3.mp3'
import celloF4 from 'tonejs-instrument-cello-mp3/F4.mp3'
import celloFs3 from 'tonejs-instrument-cello-mp3/Fs3.mp3'
import celloFs4 from 'tonejs-instrument-cello-mp3/Fs4.mp3'
import celloG2 from 'tonejs-instrument-cello-mp3/G2.mp3'
import celloG3 from 'tonejs-instrument-cello-mp3/G3.mp3'
import celloG4 from 'tonejs-instrument-cello-mp3/G4.mp3'
import celloGs2 from 'tonejs-instrument-cello-mp3/Gs2.mp3'
import celloGs3 from 'tonejs-instrument-cello-mp3/Gs3.mp3'
import celloGs4 from 'tonejs-instrument-cello-mp3/Gs4.mp3'
import guitarA2 from 'tonejs-instrument-guitar-acoustic-mp3/A2.mp3'
import guitarA3 from 'tonejs-instrument-guitar-acoustic-mp3/A3.mp3'
import guitarA4 from 'tonejs-instrument-guitar-acoustic-mp3/A4.mp3'
import guitarAs2 from 'tonejs-instrument-guitar-acoustic-mp3/As2.mp3'
import guitarAs3 from 'tonejs-instrument-guitar-acoustic-mp3/As3.mp3'
import guitarAs4 from 'tonejs-instrument-guitar-acoustic-mp3/As4.mp3'
import guitarB2 from 'tonejs-instrument-guitar-acoustic-mp3/B2.mp3'
import guitarB3 from 'tonejs-instrument-guitar-acoustic-mp3/B3.mp3'
import guitarB4 from 'tonejs-instrument-guitar-acoustic-mp3/B4.mp3'
import guitarC3 from 'tonejs-instrument-guitar-acoustic-mp3/C3.mp3'
import guitarC4 from 'tonejs-instrument-guitar-acoustic-mp3/C4.mp3'
import guitarC5 from 'tonejs-instrument-guitar-acoustic-mp3/C5.mp3'
import guitarCs3 from 'tonejs-instrument-guitar-acoustic-mp3/Cs3.mp3'
import guitarCs4 from 'tonejs-instrument-guitar-acoustic-mp3/Cs4.mp3'
import guitarCs5 from 'tonejs-instrument-guitar-acoustic-mp3/Cs5.mp3'
import guitarD2 from 'tonejs-instrument-guitar-acoustic-mp3/D2.mp3'
import guitarD3 from 'tonejs-instrument-guitar-acoustic-mp3/D3.mp3'
import guitarD4 from 'tonejs-instrument-guitar-acoustic-mp3/D4.mp3'
import guitarD5 from 'tonejs-instrument-guitar-acoustic-mp3/D5.mp3'
import guitarDs2 from 'tonejs-instrument-guitar-acoustic-mp3/Ds2.mp3'
import guitarDs3 from 'tonejs-instrument-guitar-acoustic-mp3/Ds3.mp3'
import guitarDs4 from 'tonejs-instrument-guitar-acoustic-mp3/Ds4.mp3'
import guitarE2 from 'tonejs-instrument-guitar-acoustic-mp3/E2.mp3'
import guitarE3 from 'tonejs-instrument-guitar-acoustic-mp3/E3.mp3'
import guitarE4 from 'tonejs-instrument-guitar-acoustic-mp3/E4.mp3'
import guitarF2 from 'tonejs-instrument-guitar-acoustic-mp3/F2.mp3'
import guitarF3 from 'tonejs-instrument-guitar-acoustic-mp3/F3.mp3'
import guitarF4 from 'tonejs-instrument-guitar-acoustic-mp3/F4.mp3'
import guitarFs2 from 'tonejs-instrument-guitar-acoustic-mp3/Fs2.mp3'
import guitarFs3 from 'tonejs-instrument-guitar-acoustic-mp3/Fs3.mp3'
import guitarFs4 from 'tonejs-instrument-guitar-acoustic-mp3/Fs4.mp3'
import guitarG2 from 'tonejs-instrument-guitar-acoustic-mp3/G2.mp3'
import guitarG3 from 'tonejs-instrument-guitar-acoustic-mp3/G3.mp3'
import guitarG4 from 'tonejs-instrument-guitar-acoustic-mp3/G4.mp3'
import guitarGs2 from 'tonejs-instrument-guitar-acoustic-mp3/Gs2.mp3'
import guitarGs3 from 'tonejs-instrument-guitar-acoustic-mp3/Gs3.mp3'
import guitarGs4 from 'tonejs-instrument-guitar-acoustic-mp3/Gs4.mp3'
import guitarNylonA2 from 'tonejs-instrument-guitar-nylon-mp3/A2.mp3'
import guitarNylonA3 from 'tonejs-instrument-guitar-nylon-mp3/A3.mp3'
import guitarNylonA4 from 'tonejs-instrument-guitar-nylon-mp3/A4.mp3'
import guitarNylonA5 from 'tonejs-instrument-guitar-nylon-mp3/A5.mp3'
import guitarNylonAs5 from 'tonejs-instrument-guitar-nylon-mp3/As5.mp3'
import guitarNylonB1 from 'tonejs-instrument-guitar-nylon-mp3/B1.mp3'
import guitarNylonB2 from 'tonejs-instrument-guitar-nylon-mp3/B2.mp3'
import guitarNylonB3 from 'tonejs-instrument-guitar-nylon-mp3/B3.mp3'
import guitarNylonB4 from 'tonejs-instrument-guitar-nylon-mp3/B4.mp3'
import guitarNylonCs3 from 'tonejs-instrument-guitar-nylon-mp3/Cs3.mp3'
import guitarNylonCs4 from 'tonejs-instrument-guitar-nylon-mp3/Cs4.mp3'
import guitarNylonCs5 from 'tonejs-instrument-guitar-nylon-mp3/Cs5.mp3'
import guitarNylonD2 from 'tonejs-instrument-guitar-nylon-mp3/D2.mp3'
import guitarNylonD3 from 'tonejs-instrument-guitar-nylon-mp3/D3.mp3'
import guitarNylonD5 from 'tonejs-instrument-guitar-nylon-mp3/D5.mp3'
import guitarNylonDs4 from 'tonejs-instrument-guitar-nylon-mp3/Ds4.mp3'
import guitarNylonE2 from 'tonejs-instrument-guitar-nylon-mp3/E2.mp3'
import guitarNylonE3 from 'tonejs-instrument-guitar-nylon-mp3/E3.mp3'
import guitarNylonE4 from 'tonejs-instrument-guitar-nylon-mp3/E4.mp3'
import guitarNylonE5 from 'tonejs-instrument-guitar-nylon-mp3/E5.mp3'
import guitarNylonFs2 from 'tonejs-instrument-guitar-nylon-mp3/Fs2.mp3'
import guitarNylonFs3 from 'tonejs-instrument-guitar-nylon-mp3/Fs3.mp3'
import guitarNylonFs4 from 'tonejs-instrument-guitar-nylon-mp3/Fs4.mp3'
import guitarNylonFs5 from 'tonejs-instrument-guitar-nylon-mp3/Fs5.mp3'
import guitarNylonG3 from 'tonejs-instrument-guitar-nylon-mp3/G3.mp3'
import guitarNylonG5 from 'tonejs-instrument-guitar-nylon-mp3/G5.mp3'
import guitarNylonGs2 from 'tonejs-instrument-guitar-nylon-mp3/Gs2.mp3'
import guitarNylonGs4 from 'tonejs-instrument-guitar-nylon-mp3/Gs4.mp3'
import guitarNylonGs5 from 'tonejs-instrument-guitar-nylon-mp3/Gs5.mp3'
import bassAs1 from 'tonejs-instrument-bass-electric-mp3/As1.mp3'
import bassAs2 from 'tonejs-instrument-bass-electric-mp3/As2.mp3'
import bassAs3 from 'tonejs-instrument-bass-electric-mp3/As3.mp3'
import bassAs4 from 'tonejs-instrument-bass-electric-mp3/As4.mp3'
import bassCs1 from 'tonejs-instrument-bass-electric-mp3/Cs1.mp3'
import bassCs2 from 'tonejs-instrument-bass-electric-mp3/Cs2.mp3'
import bassCs3 from 'tonejs-instrument-bass-electric-mp3/Cs3.mp3'
import bassCs4 from 'tonejs-instrument-bass-electric-mp3/Cs4.mp3'
import bassCs5 from 'tonejs-instrument-bass-electric-mp3/Cs5.mp3'
import bassE1 from 'tonejs-instrument-bass-electric-mp3/E1.mp3'
import bassE2 from 'tonejs-instrument-bass-electric-mp3/E2.mp3'
import bassE3 from 'tonejs-instrument-bass-electric-mp3/E3.mp3'
import bassE4 from 'tonejs-instrument-bass-electric-mp3/E4.mp3'
import bassG1 from 'tonejs-instrument-bass-electric-mp3/G1.mp3'
import bassG2 from 'tonejs-instrument-bass-electric-mp3/G2.mp3'
import bassG3 from 'tonejs-instrument-bass-electric-mp3/G3.mp3'
import bassG4 from 'tonejs-instrument-bass-electric-mp3/G4.mp3'

/** jsdelivr npm CDN 根（CORS 全开 + 版本化 immutable 缓存，A20 实测） */
export const CDN_BASE = 'https://cdn.jsdelivr.net/npm'

/** 单乐器采样源：CDN 尝试 + 同源打包兜底，音符键均为触发音名（As1 → A#1） */
export interface InstrumentSampleSource {
  /** npm 包精确版本；升级采样包必须重跑生成器（新鲜度测试把关） */
  readonly version: string
  /** CDN 尝试的 baseUrl（含包名@版本） */
  readonly cdnBase: string
  /** CDN 尝试：音符键 → 文件名（相对 cdnBase） */
  readonly cdnUrls: Readonly<Record<string, string>>
  /** 同源兜底：音符键 → 打包资产 URL（构建产物哈希路径） */
  readonly bundledUrls: Readonly<Record<string, string>>
}

export const SAMPLE_SOURCES: Record<InstrumentType, InstrumentSampleSource> = {
  piano: {
    version: '1.1.2',
    cdnBase: `${CDN_BASE}/tonejs-instrument-piano-mp3@1.1.2/`,
    cdnUrls: {
    'A1': 'A1.mp3',
    'A2': 'A2.mp3',
    'A3': 'A3.mp3',
    'A4': 'A4.mp3',
    'A5': 'A5.mp3',
    'A6': 'A6.mp3',
    'A7': 'A7.mp3',
    'A#1': 'As1.mp3',
    'A#2': 'As2.mp3',
    'A#3': 'As3.mp3',
    'A#4': 'As4.mp3',
    'A#5': 'As5.mp3',
    'A#6': 'As6.mp3',
    'A#7': 'As7.mp3',
    'B1': 'B1.mp3',
    'B2': 'B2.mp3',
    'B3': 'B3.mp3',
    'B4': 'B4.mp3',
    'B5': 'B5.mp3',
    'B6': 'B6.mp3',
    'B7': 'B7.mp3',
    'C1': 'C1.mp3',
    'C2': 'C2.mp3',
    'C3': 'C3.mp3',
    'C4': 'C4.mp3',
    'C5': 'C5.mp3',
    'C6': 'C6.mp3',
    'C7': 'C7.mp3',
    'C8': 'C8.mp3',
    'C#1': 'Cs1.mp3',
    'C#2': 'Cs2.mp3',
    'C#3': 'Cs3.mp3',
    'C#4': 'Cs4.mp3',
    'C#5': 'Cs5.mp3',
    'C#6': 'Cs6.mp3',
    'C#7': 'Cs7.mp3',
    'D1': 'D1.mp3',
    'D2': 'D2.mp3',
    'D3': 'D3.mp3',
    'D4': 'D4.mp3',
    'D5': 'D5.mp3',
    'D6': 'D6.mp3',
    'D7': 'D7.mp3',
    'D#1': 'Ds1.mp3',
    'D#2': 'Ds2.mp3',
    'D#3': 'Ds3.mp3',
    'D#4': 'Ds4.mp3',
    'D#5': 'Ds5.mp3',
    'D#6': 'Ds6.mp3',
    'D#7': 'Ds7.mp3',
    'E1': 'E1.mp3',
    'E2': 'E2.mp3',
    'E3': 'E3.mp3',
    'E4': 'E4.mp3',
    'E5': 'E5.mp3',
    'E6': 'E6.mp3',
    'E7': 'E7.mp3',
    'F1': 'F1.mp3',
    'F2': 'F2.mp3',
    'F3': 'F3.mp3',
    'F4': 'F4.mp3',
    'F5': 'F5.mp3',
    'F6': 'F6.mp3',
    'F7': 'F7.mp3',
    'F#1': 'Fs1.mp3',
    'F#2': 'Fs2.mp3',
    'F#3': 'Fs3.mp3',
    'F#4': 'Fs4.mp3',
    'F#5': 'Fs5.mp3',
    'F#6': 'Fs6.mp3',
    'F#7': 'Fs7.mp3',
    'G1': 'G1.mp3',
    'G2': 'G2.mp3',
    'G3': 'G3.mp3',
    'G4': 'G4.mp3',
    'G5': 'G5.mp3',
    'G6': 'G6.mp3',
    'G7': 'G7.mp3',
    'G#1': 'Gs1.mp3',
    'G#2': 'Gs2.mp3',
    'G#3': 'Gs3.mp3',
    'G#4': 'Gs4.mp3',
    'G#5': 'Gs5.mp3',
    'G#6': 'Gs6.mp3',
    'G#7': 'Gs7.mp3',
    },
    bundledUrls: {
    'A1': pianoA1,
    'A2': pianoA2,
    'A3': pianoA3,
    'A4': pianoA4,
    'A5': pianoA5,
    'A6': pianoA6,
    'A7': pianoA7,
    'A#1': pianoAs1,
    'A#2': pianoAs2,
    'A#3': pianoAs3,
    'A#4': pianoAs4,
    'A#5': pianoAs5,
    'A#6': pianoAs6,
    'A#7': pianoAs7,
    'B1': pianoB1,
    'B2': pianoB2,
    'B3': pianoB3,
    'B4': pianoB4,
    'B5': pianoB5,
    'B6': pianoB6,
    'B7': pianoB7,
    'C1': pianoC1,
    'C2': pianoC2,
    'C3': pianoC3,
    'C4': pianoC4,
    'C5': pianoC5,
    'C6': pianoC6,
    'C7': pianoC7,
    'C8': pianoC8,
    'C#1': pianoCs1,
    'C#2': pianoCs2,
    'C#3': pianoCs3,
    'C#4': pianoCs4,
    'C#5': pianoCs5,
    'C#6': pianoCs6,
    'C#7': pianoCs7,
    'D1': pianoD1,
    'D2': pianoD2,
    'D3': pianoD3,
    'D4': pianoD4,
    'D5': pianoD5,
    'D6': pianoD6,
    'D7': pianoD7,
    'D#1': pianoDs1,
    'D#2': pianoDs2,
    'D#3': pianoDs3,
    'D#4': pianoDs4,
    'D#5': pianoDs5,
    'D#6': pianoDs6,
    'D#7': pianoDs7,
    'E1': pianoE1,
    'E2': pianoE2,
    'E3': pianoE3,
    'E4': pianoE4,
    'E5': pianoE5,
    'E6': pianoE6,
    'E7': pianoE7,
    'F1': pianoF1,
    'F2': pianoF2,
    'F3': pianoF3,
    'F4': pianoF4,
    'F5': pianoF5,
    'F6': pianoF6,
    'F7': pianoF7,
    'F#1': pianoFs1,
    'F#2': pianoFs2,
    'F#3': pianoFs3,
    'F#4': pianoFs4,
    'F#5': pianoFs5,
    'F#6': pianoFs6,
    'F#7': pianoFs7,
    'G1': pianoG1,
    'G2': pianoG2,
    'G3': pianoG3,
    'G4': pianoG4,
    'G5': pianoG5,
    'G6': pianoG6,
    'G7': pianoG7,
    'G#1': pianoGs1,
    'G#2': pianoGs2,
    'G#3': pianoGs3,
    'G#4': pianoGs4,
    'G#5': pianoGs5,
    'G#6': pianoGs6,
    'G#7': pianoGs7,
    },
  },
  saxophone: {
    version: '1.1.2',
    cdnBase: `${CDN_BASE}/tonejs-instrument-saxophone-mp3@1.1.2/`,
    cdnUrls: {
    'A4': 'A4.mp3',
    'A5': 'A5.mp3',
    'A#3': 'As3.mp3',
    'A#4': 'As4.mp3',
    'B3': 'B3.mp3',
    'B4': 'B4.mp3',
    'C4': 'C4.mp3',
    'C5': 'C5.mp3',
    'C#3': 'Cs3.mp3',
    'C#4': 'Cs4.mp3',
    'C#5': 'Cs5.mp3',
    'D3': 'D3.mp3',
    'D4': 'D4.mp3',
    'D5': 'D5.mp3',
    'D#3': 'Ds3.mp3',
    'D#4': 'Ds4.mp3',
    'D#5': 'Ds5.mp3',
    'E3': 'E3.mp3',
    'E4': 'E4.mp3',
    'E5': 'E5.mp3',
    'F3': 'F3.mp3',
    'F4': 'F4.mp3',
    'F5': 'F5.mp3',
    'F#3': 'Fs3.mp3',
    'F#4': 'Fs4.mp3',
    'F#5': 'Fs5.mp3',
    'G3': 'G3.mp3',
    'G4': 'G4.mp3',
    'G5': 'G5.mp3',
    'G#3': 'Gs3.mp3',
    'G#4': 'Gs4.mp3',
    'G#5': 'Gs5.mp3',
    },
    bundledUrls: {
    'A4': saxophoneA4,
    'A5': saxophoneA5,
    'A#3': saxophoneAs3,
    'A#4': saxophoneAs4,
    'B3': saxophoneB3,
    'B4': saxophoneB4,
    'C4': saxophoneC4,
    'C5': saxophoneC5,
    'C#3': saxophoneCs3,
    'C#4': saxophoneCs4,
    'C#5': saxophoneCs5,
    'D3': saxophoneD3,
    'D4': saxophoneD4,
    'D5': saxophoneD5,
    'D#3': saxophoneDs3,
    'D#4': saxophoneDs4,
    'D#5': saxophoneDs5,
    'E3': saxophoneE3,
    'E4': saxophoneE4,
    'E5': saxophoneE5,
    'F3': saxophoneF3,
    'F4': saxophoneF4,
    'F5': saxophoneF5,
    'F#3': saxophoneFs3,
    'F#4': saxophoneFs4,
    'F#5': saxophoneFs5,
    'G3': saxophoneG3,
    'G4': saxophoneG4,
    'G5': saxophoneG5,
    'G#3': saxophoneGs3,
    'G#4': saxophoneGs4,
    'G#5': saxophoneGs5,
    },
  },
  clarinet: {
    version: '1.1.2',
    cdnBase: `${CDN_BASE}/tonejs-instrument-clarinet-mp3@1.1.2/`,
    cdnUrls: {
    'A#3': 'As3.mp3',
    'A#4': 'As4.mp3',
    'A#5': 'As5.mp3',
    'D3': 'D3.mp3',
    'D4': 'D4.mp3',
    'D5': 'D5.mp3',
    'D6': 'D6.mp3',
    'F3': 'F3.mp3',
    'F4': 'F4.mp3',
    'F5': 'F5.mp3',
    'F#6': 'Fs6.mp3',
    },
    bundledUrls: {
    'A#3': clarinetAs3,
    'A#4': clarinetAs4,
    'A#5': clarinetAs5,
    'D3': clarinetD3,
    'D4': clarinetD4,
    'D5': clarinetD5,
    'D6': clarinetD6,
    'F3': clarinetF3,
    'F4': clarinetF4,
    'F5': clarinetF5,
    'F#6': clarinetFs6,
    },
  },
  flute: {
    version: '1.1.2',
    cdnBase: `${CDN_BASE}/tonejs-instrument-flute-mp3@1.1.2/`,
    cdnUrls: {
    'A4': 'A4.mp3',
    'A5': 'A5.mp3',
    'A6': 'A6.mp3',
    'C4': 'C4.mp3',
    'C5': 'C5.mp3',
    'C6': 'C6.mp3',
    'C7': 'C7.mp3',
    'E4': 'E4.mp3',
    'E5': 'E5.mp3',
    'E6': 'E6.mp3',
    },
    bundledUrls: {
    'A4': fluteA4,
    'A5': fluteA5,
    'A6': fluteA6,
    'C4': fluteC4,
    'C5': fluteC5,
    'C6': fluteC6,
    'C7': fluteC7,
    'E4': fluteE4,
    'E5': fluteE5,
    'E6': fluteE6,
    },
  },
  trumpet: {
    version: '1.1.2',
    cdnBase: `${CDN_BASE}/tonejs-instrument-trumpet-mp3@1.1.2/`,
    cdnUrls: {
    'A3': 'A3.mp3',
    'A5': 'A5.mp3',
    'A#3': 'As3.mp3',
    'C3': 'C3.mp3',
    'C6': 'C6.mp3',
    'D5': 'D5.mp3',
    'D#4': 'Ds4.mp3',
    'F3': 'F3.mp3',
    'F4': 'F4.mp3',
    'F5': 'F5.mp3',
    'G4': 'G4.mp3',
    },
    bundledUrls: {
    'A3': trumpetA3,
    'A5': trumpetA5,
    'A#3': trumpetAs3,
    'C3': trumpetC3,
    'C6': trumpetC6,
    'D5': trumpetD5,
    'D#4': trumpetDs4,
    'F3': trumpetF3,
    'F4': trumpetF4,
    'F5': trumpetF5,
    'G4': trumpetG4,
    },
  },
  frenchHorn: {
    version: '1.1.2',
    cdnBase: `${CDN_BASE}/tonejs-instrument-french-horn-mp3@1.1.2/`,
    cdnUrls: {
    'A1': 'A1.mp3',
    'A3': 'A3.mp3',
    'C2': 'C2.mp3',
    'C4': 'C4.mp3',
    'D3': 'D3.mp3',
    'D5': 'D5.mp3',
    'D#2': 'Ds2.mp3',
    'F3': 'F3.mp3',
    'F5': 'F5.mp3',
    'G2': 'G2.mp3',
    },
    bundledUrls: {
    'A1': frenchHornA1,
    'A3': frenchHornA3,
    'C2': frenchHornC2,
    'C4': frenchHornC4,
    'D3': frenchHornD3,
    'D5': frenchHornD5,
    'D#2': frenchHornDs2,
    'F3': frenchHornF3,
    'F5': frenchHornF5,
    'G2': frenchHornG2,
    },
  },
  trombone: {
    version: '1.1.2',
    cdnBase: `${CDN_BASE}/tonejs-instrument-trombone-mp3@1.1.2/`,
    cdnUrls: {
    'A#1': 'As1.mp3',
    'A#2': 'As2.mp3',
    'A#3': 'As3.mp3',
    'C3': 'C3.mp3',
    'C4': 'C4.mp3',
    'C#2': 'Cs2.mp3',
    'C#4': 'Cs4.mp3',
    'D3': 'D3.mp3',
    'D4': 'D4.mp3',
    'D#2': 'Ds2.mp3',
    'D#3': 'Ds3.mp3',
    'D#4': 'Ds4.mp3',
    'F2': 'F2.mp3',
    'F3': 'F3.mp3',
    'F4': 'F4.mp3',
    'G#2': 'Gs2.mp3',
    'G#3': 'Gs3.mp3',
    },
    bundledUrls: {
    'A#1': tromboneAs1,
    'A#2': tromboneAs2,
    'A#3': tromboneAs3,
    'C3': tromboneC3,
    'C4': tromboneC4,
    'C#2': tromboneCs2,
    'C#4': tromboneCs4,
    'D3': tromboneD3,
    'D4': tromboneD4,
    'D#2': tromboneDs2,
    'D#3': tromboneDs3,
    'D#4': tromboneDs4,
    'F2': tromboneF2,
    'F3': tromboneF3,
    'F4': tromboneF4,
    'G#2': tromboneGs2,
    'G#3': tromboneGs3,
    },
  },
  violin: {
    version: '1.1.1',
    cdnBase: `${CDN_BASE}/tonejs-instrument-violin-mp3@1.1.1/`,
    cdnUrls: {
    'A3': 'A3.mp3',
    'A4': 'A4.mp3',
    'A5': 'A5.mp3',
    'A6': 'A6.mp3',
    'C4': 'C4.mp3',
    'C5': 'C5.mp3',
    'C6': 'C6.mp3',
    'C7': 'C7.mp3',
    'E4': 'E4.mp3',
    'E5': 'E5.mp3',
    'E6': 'E6.mp3',
    'G3': 'G3.mp3',
    'G4': 'G4.mp3',
    'G5': 'G5.mp3',
    'G6': 'G6.mp3',
    },
    bundledUrls: {
    'A3': violinA3,
    'A4': violinA4,
    'A5': violinA5,
    'A6': violinA6,
    'C4': violinC4,
    'C5': violinC5,
    'C6': violinC6,
    'C7': violinC7,
    'E4': violinE4,
    'E5': violinE5,
    'E6': violinE6,
    'G3': violinG3,
    'G4': violinG4,
    'G5': violinG5,
    'G6': violinG6,
    },
  },
  cello: {
    version: '1.1.1',
    cdnBase: `${CDN_BASE}/tonejs-instrument-cello-mp3@1.1.1/`,
    cdnUrls: {
    'A2': 'A2.mp3',
    'A3': 'A3.mp3',
    'A4': 'A4.mp3',
    'A#2': 'As2.mp3',
    'A#3': 'As3.mp3',
    'A#4': 'As4.mp3',
    'B2': 'B2.mp3',
    'B3': 'B3.mp3',
    'B4': 'B4.mp3',
    'C2': 'C2.mp3',
    'C3': 'C3.mp3',
    'C4': 'C4.mp3',
    'C5': 'C5.mp3',
    'C#3': 'Cs3.mp3',
    'C#4': 'Cs4.mp3',
    'D2': 'D2.mp3',
    'D3': 'D3.mp3',
    'D4': 'D4.mp3',
    'D#2': 'Ds2.mp3',
    'D#3': 'Ds3.mp3',
    'D#4': 'Ds4.mp3',
    'E2': 'E2.mp3',
    'E3': 'E3.mp3',
    'E4': 'E4.mp3',
    'F2': 'F2.mp3',
    'F3': 'F3.mp3',
    'F4': 'F4.mp3',
    'F#3': 'Fs3.mp3',
    'F#4': 'Fs4.mp3',
    'G2': 'G2.mp3',
    'G3': 'G3.mp3',
    'G4': 'G4.mp3',
    'G#2': 'Gs2.mp3',
    'G#3': 'Gs3.mp3',
    'G#4': 'Gs4.mp3',
    },
    bundledUrls: {
    'A2': celloA2,
    'A3': celloA3,
    'A4': celloA4,
    'A#2': celloAs2,
    'A#3': celloAs3,
    'A#4': celloAs4,
    'B2': celloB2,
    'B3': celloB3,
    'B4': celloB4,
    'C2': celloC2,
    'C3': celloC3,
    'C4': celloC4,
    'C5': celloC5,
    'C#3': celloCs3,
    'C#4': celloCs4,
    'D2': celloD2,
    'D3': celloD3,
    'D4': celloD4,
    'D#2': celloDs2,
    'D#3': celloDs3,
    'D#4': celloDs4,
    'E2': celloE2,
    'E3': celloE3,
    'E4': celloE4,
    'F2': celloF2,
    'F3': celloF3,
    'F4': celloF4,
    'F#3': celloFs3,
    'F#4': celloFs4,
    'G2': celloG2,
    'G3': celloG3,
    'G4': celloG4,
    'G#2': celloGs2,
    'G#3': celloGs3,
    'G#4': celloGs4,
    },
  },
  guitar: {
    version: '1.1.2',
    cdnBase: `${CDN_BASE}/tonejs-instrument-guitar-acoustic-mp3@1.1.2/`,
    cdnUrls: {
    'A2': 'A2.mp3',
    'A3': 'A3.mp3',
    'A4': 'A4.mp3',
    'A#2': 'As2.mp3',
    'A#3': 'As3.mp3',
    'A#4': 'As4.mp3',
    'B2': 'B2.mp3',
    'B3': 'B3.mp3',
    'B4': 'B4.mp3',
    'C3': 'C3.mp3',
    'C4': 'C4.mp3',
    'C5': 'C5.mp3',
    'C#3': 'Cs3.mp3',
    'C#4': 'Cs4.mp3',
    'C#5': 'Cs5.mp3',
    'D2': 'D2.mp3',
    'D3': 'D3.mp3',
    'D4': 'D4.mp3',
    'D5': 'D5.mp3',
    'D#2': 'Ds2.mp3',
    'D#3': 'Ds3.mp3',
    'D#4': 'Ds4.mp3',
    'E2': 'E2.mp3',
    'E3': 'E3.mp3',
    'E4': 'E4.mp3',
    'F2': 'F2.mp3',
    'F3': 'F3.mp3',
    'F4': 'F4.mp3',
    'F#2': 'Fs2.mp3',
    'F#3': 'Fs3.mp3',
    'F#4': 'Fs4.mp3',
    'G2': 'G2.mp3',
    'G3': 'G3.mp3',
    'G4': 'G4.mp3',
    'G#2': 'Gs2.mp3',
    'G#3': 'Gs3.mp3',
    'G#4': 'Gs4.mp3',
    },
    bundledUrls: {
    'A2': guitarA2,
    'A3': guitarA3,
    'A4': guitarA4,
    'A#2': guitarAs2,
    'A#3': guitarAs3,
    'A#4': guitarAs4,
    'B2': guitarB2,
    'B3': guitarB3,
    'B4': guitarB4,
    'C3': guitarC3,
    'C4': guitarC4,
    'C5': guitarC5,
    'C#3': guitarCs3,
    'C#4': guitarCs4,
    'C#5': guitarCs5,
    'D2': guitarD2,
    'D3': guitarD3,
    'D4': guitarD4,
    'D5': guitarD5,
    'D#2': guitarDs2,
    'D#3': guitarDs3,
    'D#4': guitarDs4,
    'E2': guitarE2,
    'E3': guitarE3,
    'E4': guitarE4,
    'F2': guitarF2,
    'F3': guitarF3,
    'F4': guitarF4,
    'F#2': guitarFs2,
    'F#3': guitarFs3,
    'F#4': guitarFs4,
    'G2': guitarG2,
    'G3': guitarG3,
    'G4': guitarG4,
    'G#2': guitarGs2,
    'G#3': guitarGs3,
    'G#4': guitarGs4,
    },
  },
  guitarNylon: {
    version: '1.1.1',
    cdnBase: `${CDN_BASE}/tonejs-instrument-guitar-nylon-mp3@1.1.1/`,
    cdnUrls: {
    'A2': 'A2.mp3',
    'A3': 'A3.mp3',
    'A4': 'A4.mp3',
    'A5': 'A5.mp3',
    'A#5': 'As5.mp3',
    'B1': 'B1.mp3',
    'B2': 'B2.mp3',
    'B3': 'B3.mp3',
    'B4': 'B4.mp3',
    'C#3': 'Cs3.mp3',
    'C#4': 'Cs4.mp3',
    'C#5': 'Cs5.mp3',
    'D2': 'D2.mp3',
    'D3': 'D3.mp3',
    'D5': 'D5.mp3',
    'D#4': 'Ds4.mp3',
    'E2': 'E2.mp3',
    'E3': 'E3.mp3',
    'E4': 'E4.mp3',
    'E5': 'E5.mp3',
    'F#2': 'Fs2.mp3',
    'F#3': 'Fs3.mp3',
    'F#4': 'Fs4.mp3',
    'F#5': 'Fs5.mp3',
    'G3': 'G3.mp3',
    'G5': 'G5.mp3',
    'G#2': 'Gs2.mp3',
    'G#4': 'Gs4.mp3',
    'G#5': 'Gs5.mp3',
    },
    bundledUrls: {
    'A2': guitarNylonA2,
    'A3': guitarNylonA3,
    'A4': guitarNylonA4,
    'A5': guitarNylonA5,
    'A#5': guitarNylonAs5,
    'B1': guitarNylonB1,
    'B2': guitarNylonB2,
    'B3': guitarNylonB3,
    'B4': guitarNylonB4,
    'C#3': guitarNylonCs3,
    'C#4': guitarNylonCs4,
    'C#5': guitarNylonCs5,
    'D2': guitarNylonD2,
    'D3': guitarNylonD3,
    'D5': guitarNylonD5,
    'D#4': guitarNylonDs4,
    'E2': guitarNylonE2,
    'E3': guitarNylonE3,
    'E4': guitarNylonE4,
    'E5': guitarNylonE5,
    'F#2': guitarNylonFs2,
    'F#3': guitarNylonFs3,
    'F#4': guitarNylonFs4,
    'F#5': guitarNylonFs5,
    'G3': guitarNylonG3,
    'G5': guitarNylonG5,
    'G#2': guitarNylonGs2,
    'G#4': guitarNylonGs4,
    'G#5': guitarNylonGs5,
    },
  },
  bass: {
    version: '1.1.2',
    cdnBase: `${CDN_BASE}/tonejs-instrument-bass-electric-mp3@1.1.2/`,
    cdnUrls: {
    'A#1': 'As1.mp3',
    'A#2': 'As2.mp3',
    'A#3': 'As3.mp3',
    'A#4': 'As4.mp3',
    'C#1': 'Cs1.mp3',
    'C#2': 'Cs2.mp3',
    'C#3': 'Cs3.mp3',
    'C#4': 'Cs4.mp3',
    'C#5': 'Cs5.mp3',
    'E1': 'E1.mp3',
    'E2': 'E2.mp3',
    'E3': 'E3.mp3',
    'E4': 'E4.mp3',
    'G1': 'G1.mp3',
    'G2': 'G2.mp3',
    'G3': 'G3.mp3',
    'G4': 'G4.mp3',
    },
    bundledUrls: {
    'A#1': bassAs1,
    'A#2': bassAs2,
    'A#3': bassAs3,
    'A#4': bassAs4,
    'C#1': bassCs1,
    'C#2': bassCs2,
    'C#3': bassCs3,
    'C#4': bassCs4,
    'C#5': bassCs5,
    'E1': bassE1,
    'E2': bassE2,
    'E3': bassE3,
    'E4': bassE4,
    'G1': bassG1,
    'G2': bassG2,
    'G3': bassG3,
    'G4': bassG4,
    },
  },
}
